interface NavtalkSessionCallbacks {
  onStatusChange?: (status: NavtalkSessionStatus) => void
  onUserTranscript?: (transcript: string) => void
  onAssistantPartial?: (payload: { responseId: string; text: string }) => void
  onAssistantComplete?: (payload: { responseId: string; text: string }) => void
  onError?: (error: string) => void
}

export type NavtalkSessionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'ready'
  | 'listening'
  | 'speaking'
  | 'stopped'
  | 'error'

interface NavtalkSessionOptions extends NavtalkSessionCallbacks {
  license: string
  characterName: string
  voice: string
  baseUrl: string
  prompt: string
  videoElement?: HTMLVideoElement | null
}

const ICE_CONFIGURATION: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

export class NavtalkSession {
  private readonly license: string
  private readonly characterName: string
  private readonly voice: string
  private readonly baseUrl: string
  private readonly prompt: string
  private readonly callbacks: NavtalkSessionCallbacks
  private readonly videoElement?: HTMLVideoElement | null

  private socket: WebSocket | null = null
  private resultSocket: WebSocket | null = null
  private peerConnection: RTCPeerConnection | null = null

  private audioContext: AudioContext | null = null
  private audioProcessor: ScriptProcessorNode | null = null
  private audioStream: MediaStream | null = null

  private responseBuffer = new Map<string, string>()
  private status: NavtalkSessionStatus = 'idle'
  private isRecording = false
  private configuration: RTCConfiguration = { ...ICE_CONFIGURATION }

  constructor(options: NavtalkSessionOptions) {
    this.license = options.license
    this.characterName = options.characterName
    this.voice = options.voice
    this.baseUrl = options.baseUrl
    this.prompt = options.prompt
    this.callbacks = options
    this.videoElement = options.videoElement ?? null
  }

  async start() {
    if (this.status !== 'idle') {
      await this.stop()
    }

    if (typeof window === 'undefined') {
      throw new Error('NavtalkSession can only run in browser environment')
    }

    this.setStatus('connecting')
    this.initializeMainWebSocket()
    this.initializeResultWebSocket()
  }

  async stop() {
    this.setStatus('stopped')
    this.cleanupAudio()
    this.cleanupPeerConnection()

    if (this.socket) {
      try {
        this.socket.close()
      } catch (error) {
        console.error('Error closing realtime socket', error)
      }
    }

    if (this.resultSocket) {
      try {
        this.resultSocket.close()
      } catch (error) {
        console.error('Error closing result socket', error)
      }
    }

    this.socket = null
    this.resultSocket = null
    this.responseBuffer.clear()
  }

  private initializeMainWebSocket() {
    const websocketUrl = `wss://${this.baseUrl}/api/realtime-api`
    const withParams = `${websocketUrl}?license=${encodeURIComponent(this.license)}&characterName=${encodeURIComponent(this.characterName)}`

    this.socket = new WebSocket(withParams)
    this.socket.binaryType = 'arraybuffer'

    this.socket.onopen = () => {
      this.setStatus('connected')
    }

    this.socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const data = JSON.parse(event.data)
          this.handleRealtimeMessage(data)
        } catch (error) {
          console.error('Failed to parse realtime message', error)
        }
      }
    }

    this.socket.onerror = (event) => {
      console.error('Realtime WebSocket error', event)
      this.setStatus('error')
      this.callbacks.onError?.('Realtime connection error. Please try again.')
    }

    this.socket.onclose = () => {
      this.stop().catch(() => {
        // ignore
      })
    }
  }

  private initializeResultWebSocket() {
    const targetSessionId = this.license
    const endpoint = `wss://${this.baseUrl}/api/webrtc?userId=${encodeURIComponent(targetSessionId)}`

    this.resultSocket = new WebSocket(endpoint)

    this.resultSocket.onopen = () => {
      const message = { type: 'create', targetSessionId }
      this.resultSocket?.send(JSON.stringify(message))
    }

    this.resultSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string)
        switch (message.type) {
          case 'offer':
            // Handle asynchronously; no need to await in event loop
            void this.handleOffer(message)
            break
          case 'iceCandidate':
            this.handleIceCandidate(message)
            break
          default:
            break
        }
      } catch (error) {
        console.error('Failed to parse result socket message', error)
      }
    }

    this.resultSocket.onerror = (event) => {
      console.error('Result WebSocket error', event)
      this.callbacks.onError?.('')
    }
  }

  private async handleOffer(message: any) {
    const offer = new RTCSessionDescription(message.sdp)

    // Try to obtain TURN/STUN servers from the transfer service.
    // Falls back to default STUN-only configuration on failure.
    try {
      const endpoint = `https://${this.baseUrl}/api/webrtc/generate-ice-servers`
      const res = await fetch(endpoint, { method: 'POST' })
      if (res.ok) {
        const data: any = await res.json()
        const servers = data?.data?.iceServers ?? data?.iceServers
        if (Array.isArray(servers) && servers.length > 0) {
          this.configuration = { iceServers: servers }
        }
      }
    } catch (e) {
      // keep default configuration
    }

    this.cleanupPeerConnection()
    this.peerConnection = new RTCPeerConnection(this.configuration)

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.resultSocket?.readyState === WebSocket.OPEN) {
        const payload = {
          type: 'iceCandidate',
          targetSessionId: message.targetSessionId,
          candidate: event.candidate,
        }
        this.resultSocket.send(JSON.stringify(payload))
      }
    }

    this.peerConnection.ontrack = (event) => {
      const stream = event.streams[0]
      if (this.videoElement) {
        this.videoElement.srcObject = stream
        this.videoElement.play().catch((error) => {
          console.error('Failed to autoplay remote stream', error)
        })
      }
    }

    this.peerConnection.onconnectionstatechange = () => {
      if (!this.peerConnection) {
        return
      }

      if (this.peerConnection.connectionState === 'connected') {
        this.setStatus('ready')
      } else if (this.peerConnection.connectionState === 'failed') {
        this.callbacks.onError?.('')
      }
    }

    await this.peerConnection.setRemoteDescription(offer)
    const answer = await this.peerConnection.createAnswer()
    await this.peerConnection.setLocalDescription(answer)

    if (this.resultSocket?.readyState === WebSocket.OPEN) {
      const responseMessage = {
        type: 'answer',
        targetSessionId: message.targetSessionId,
        sdp: this.peerConnection.localDescription,
      }
      this.resultSocket.send(JSON.stringify(responseMessage))
    }
  }

  private handleIceCandidate(message: any) {
    if (!this.peerConnection || !message.candidate) {
      return
    }

    this.peerConnection
      .addIceCandidate(new RTCIceCandidate(message.candidate))
      .catch((error) => {
        console.error('Failed to add ICE candidate', error)
      })
  }

  private handleRealtimeMessage(data: any) {
    switch (data.type) {
      case 'session.created':
        this.sendSessionUpdate()
        break
      case 'session.updated':
        this.setStatus('ready')
        this.requestAssistantResponse()
        this.startRecording()
        break
      case 'input_audio_buffer.speech_started':
        this.setStatus('listening')
        break
      case 'input_audio_buffer.speech_stopped':
        this.setStatus('connected')
        break
      case 'conversation.item.input_audio_transcription.completed':
        if (data.transcript) {
          this.callbacks.onUserTranscript?.(data.transcript)
        }
        break
      case 'response.audio_transcript.delta':
        if (data.response_id && typeof data.delta === 'string') {
          const previous = this.responseBuffer.get(data.response_id) ?? ''
          const next = previous + data.delta
          this.responseBuffer.set(data.response_id, next)
          this.callbacks.onAssistantPartial?.({
            responseId: data.response_id,
            text: next,
          })
          this.setStatus('speaking')
        }
        break
      case 'response.audio_transcript.done':
        if (data.response_id) {
          const text = data.transcript ?? this.responseBuffer.get(data.response_id) ?? ''
          this.callbacks.onAssistantComplete?.({
            responseId: data.response_id,
            text,
          })
          this.responseBuffer.delete(data.response_id)
        }
        break
      case 'session.gpu_full':
        this.callbacks.onError?.('GPU resources are currently busy. Please try again later.')
        break
      case 'session.insufficient_balance':
        this.callbacks.onError?.('Account balance is insufficient. Please top up to continue.')
        break
      default:
        break
    }
  }

  private sendSessionUpdate() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return
    }

    const sessionConfig = {
      type: 'session.update',
      session: {
        instructions: this.prompt,
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
        voice: this.voice,
        temperature: 1,
        max_response_output_tokens: 4096,
        modalities: ['text', 'audio'],
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1',
        },
      },
    }

    this.socket.send(JSON.stringify(sessionConfig))
  }

  public requestAssistantResponse() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return
    }

    try {
      this.socket.send(JSON.stringify({ type: 'response.create' }))
    } catch (error) {
      console.error('Failed to request assistant response', error)
    }
  }

  private startRecording() {
    if (this.isRecording || typeof navigator === 'undefined') {
      return
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
        this.audioContext = new AudioContextCtor({ sampleRate: 24000 })
        this.audioStream = stream

        const source = this.audioContext.createMediaStreamSource(stream)
        this.audioProcessor = this.audioContext.createScriptProcessor(8192, 1, 1)

        this.audioProcessor.onaudioprocess = (event) => {
          if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return
          }
          const inputBuffer = event.inputBuffer.getChannelData(0)
          const pcmData = this.floatTo16BitPCM(inputBuffer)
          const base64PCM = this.base64EncodeAudio(new Uint8Array(pcmData))
          const chunkSize = 4096
          for (let i = 0; i < base64PCM.length; i += chunkSize) {
            const chunk = base64PCM.slice(i, i + chunkSize)
            this.socket.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: chunk }))
          }
        }

        source.connect(this.audioProcessor)
        this.audioProcessor.connect(this.audioContext.destination)
        this.isRecording = true
      })
      .catch((error) => {
        console.error('Unable to access microphone', error)
        this.callbacks.onError?.('Unable to access the microphone. Please enable browser audio permissions.')
      })
  }

  private cleanupAudio() {
    if (this.audioProcessor) {
      try {
        this.audioProcessor.disconnect()
      } catch (error) {
        // ignore
      }
    }

    if (this.audioContext) {
      try {
        this.audioContext.close()
      } catch (error) {
        // ignore
      }
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop())
    }

    this.audioProcessor = null
    this.audioContext = null
    this.audioStream = null
    this.isRecording = false
  }

  private cleanupPeerConnection() {
    if (this.peerConnection) {
      this.peerConnection.ontrack = null
      this.peerConnection.onicecandidate = null
      this.peerConnection.onconnectionstatechange = null
      try {
        this.peerConnection.close()
      } catch (error) {
        // ignore
      }
    }

    this.peerConnection = null

    if (this.videoElement) {
      this.videoElement.pause()
      this.videoElement.srcObject = null
    }
  }

  private floatTo16BitPCM(float32Array: Float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2)
    const view = new DataView(buffer)
    let offset = 0
    for (let i = 0; i < float32Array.length; i += 1, offset += 2) {
      let s = Math.max(-1, Math.min(1, float32Array[i]))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    }
    return buffer
  }

  private base64EncodeAudio(uint8Array: Uint8Array) {
    let binary = ''
    const chunkSize = 0x8000
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize)
      binary += String.fromCharCode.apply(null, Array.from(chunk))
    }
    return btoa(binary)
  }

  private setStatus(status: NavtalkSessionStatus) {
    this.status = status
    this.callbacks.onStatusChange?.(status)
  }
}

