interface NavtalkSessionCallbacks {
  onStatusChange?: (status: NavtalkSessionStatus) => void
  onUserTranscript?: (transcript: string) => void
  onAssistantPartial?: (payload: { responseId: string; text: string }) => void
  onAssistantComplete?: (payload: { responseId: string; text: string }) => void
  onAutoHangup?: (reason: string) => void
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
  model: string
  baseUrl: string
  prompt: string
  videoElement?: HTMLVideoElement | null
}

const NavTalkMessageType = {
  CONNECTED_SUCCESS: 'conversation.connected.success',
  CONNECTED_FAIL: 'conversation.connected.fail',
  CONNECTED_CLOSE: 'conversation.connected.close',
  INSUFFICIENT_BALANCE: 'conversation.connected.insufficient_balance',
  WEB_RTC_OFFER: 'webrtc.signaling.offer',
  WEB_RTC_ANSWER: 'webrtc.signaling.answer',
  WEB_RTC_ICE_CANDIDATE: 'webrtc.signaling.iceCandidate',
  REALTIME_SESSION_CREATED: 'realtime.session.created',
  REALTIME_SESSION_UPDATED: 'realtime.session.updated',
  REALTIME_SPEECH_STARTED: 'realtime.input_audio_buffer.speech_started',
  REALTIME_SPEECH_STOPPED: 'realtime.input_audio_buffer.speech_stopped',
  REALTIME_CONVERSATION_ITEM_COMPLETED: 'realtime.conversation.item.input_audio_transcription.completed',
  REALTIME_RESPONSE_AUDIO_TRANSCRIPT_DELTA: 'realtime.response.audio_transcript.delta',
  REALTIME_RESPONSE_AUDIO_DELTA: 'realtime.response.audio.delta',
  REALTIME_RESPONSE_AUDIO_TRANSCRIPT_DONE: 'realtime.response.audio_transcript.done',
  REALTIME_RESPONSE_AUDIO_DONE: 'realtime.response.audio.done',
  REALTIME_RESPONSE_FUNCTION_CALL_ARGUMENTS_DELTA: 'realtime.response.function_call_arguments.delta',
  REALTIME_RESPONSE_FUNCTION_CALL_ARGUMENTS_DONE: 'realtime.response.function_call_arguments.done',
  REALTIME_RESPONSE_COMPLETED: 'realtime.response.completed',
  REALTIME_RESPONSE_ERROR: 'realtime.response.error',
  REALTIME_INPUT_AUDIO_BUFFER_APPEND: 'realtime.input_audio_buffer.append',
  REALTIME_INPUT_TEXT: 'realtime.input_text',
  REALTIME_INPUT_IMAGE: 'realtime.input_image',
  REALTIME_INPUT_CONFIG: 'realtime.input_config',
  RESPONSE_CREATE: 'response.create',
  CONVERSATION_ITEM_CREATE: 'conversation.item.create',
  SESSION_GPU_FULL: 'realtime.session.gpu_full',
  SESSION_INSUFFICIENT_BALANCE: 'realtime.session.insufficient_balance',
} as const

const ICE_CONFIGURATION: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

export class NavtalkSession {
  private readonly license: string
  private readonly characterName: string
  private readonly voice: string
  private readonly baseUrl: string
  private readonly prompt: string
  private readonly model: string
  private readonly callbacks: NavtalkSessionCallbacks
  private readonly videoElement?: HTMLVideoElement | null

  private socket: WebSocket | null = null
  private peerConnection: RTCPeerConnection | null = null

  private audioContext: AudioContext | null = null
  private audioProcessor: ScriptProcessorNode | null = null
  private audioStream: MediaStream | null = null

  private responseBuffer = new Map<string, string>()
  private status: NavtalkSessionStatus = 'idle'
  private isRecording = false
  private configuration: RTCConfiguration = { ...ICE_CONFIGURATION }
  private pendingHangupReason: string | null = null

  constructor(options: NavtalkSessionOptions) {
    this.license = options.license
    this.characterName = options.characterName
    this.voice = options.voice
    this.model = options.model
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

    this.pendingHangupReason = null
    this.setStatus('connecting')
    this.initializeMainWebSocket()
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

    this.socket = null
    this.responseBuffer.clear()
    this.pendingHangupReason = null
  }

  private initializeMainWebSocket() {
    const websocketUrl = this.buildWebsocketUrl()
    const params = new URLSearchParams({
      license: this.license,
      name: this.characterName,
      model: this.model,
    })
    const withParams = websocketUrl.includes('?') ? `${websocketUrl}&${params}` : `${websocketUrl}?${params}`

    this.socket = new WebSocket(withParams)
    this.socket.binaryType = 'arraybuffer'

    this.socket.onopen = () => {
      this.setStatus('connected')
      this.sendSessionConfig()
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

  private buildWebsocketUrl() {
    if (this.baseUrl.startsWith('ws://') || this.baseUrl.startsWith('wss://')) {
      return this.baseUrl
    }
    return `wss://${this.baseUrl}/wss/v2/realtime-chat`
  }

  private getApiHost() {
    if (this.baseUrl.startsWith('ws://') || this.baseUrl.startsWith('wss://')) {
      try {
        return new URL(this.baseUrl).host
      } catch {
        return this.baseUrl.replace(/^wss?:\/\//, '')
      }
    }
    return this.baseUrl
  }

  private sendSignalingMessage(type: string, data: Record<string, unknown>) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return
    }
    this.socket.send(JSON.stringify({ type, data }))
  }

  private async handleOffer(message: any) {
    const offer = new RTCSessionDescription(message.sdp)

    this.cleanupPeerConnection()
    this.peerConnection = new RTCPeerConnection(this.configuration)

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage(NavTalkMessageType.WEB_RTC_ICE_CANDIDATE, {
          candidate: event.candidate,
        })
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

    if (this.peerConnection.localDescription) {
      this.sendSignalingMessage(NavTalkMessageType.WEB_RTC_ANSWER, {
        sdp: this.peerConnection.localDescription,
      })
    }
  }

  private handleIceCandidate(message: any) {
    const candidate = message.candidate ?? message.data?.candidate
    if (!this.peerConnection || !candidate) {
      return
    }

    this.peerConnection
      .addIceCandidate(new RTCIceCandidate(candidate))
      .catch((error) => {
        console.error('Failed to add ICE candidate', error)
      })
  }

  private handleAnswer(message: any) {
    const sdp = message.sdp ?? message.data?.sdp
    if (!this.peerConnection || !sdp) {
      return
    }
    this.peerConnection
      .setRemoteDescription(new RTCSessionDescription(sdp))
      .catch((error) => {
        console.error('Failed to handle Answer', error)
      })
  }

  private handleRealtimeMessage(data: any) {
    const payload = data.data ?? data
    switch (data.type) {
      case NavTalkMessageType.CONNECTED_SUCCESS: {
        const iceServers = payload?.iceServers ?? payload?.ice_servers
        if (Array.isArray(iceServers) && iceServers.length > 0) {
          this.configuration = { iceServers }
        }
        break
      }
      case NavTalkMessageType.CONNECTED_FAIL:
      case NavTalkMessageType.CONNECTED_CLOSE: {
        const errorMessage = data.message ?? payload?.message ?? 'Realtime connection error'
        this.callbacks.onError?.(errorMessage)
        this.setStatus('error')
        break
      }
      case NavTalkMessageType.REALTIME_SESSION_CREATED:
        this.sendSessionUpdate()
        break
      case NavTalkMessageType.REALTIME_SESSION_UPDATED:
        this.setStatus('ready')
        this.requestAssistantResponse()
        this.startRecording()
        break
      case NavTalkMessageType.REALTIME_SPEECH_STARTED:
        this.setStatus('listening')
        break
      case NavTalkMessageType.REALTIME_SPEECH_STOPPED:
        this.setStatus('connected')
        break
      case NavTalkMessageType.REALTIME_CONVERSATION_ITEM_COMPLETED:
        if (typeof payload?.content === 'string' && payload.content.length > 0) {
          this.callbacks.onUserTranscript?.(payload.content)
        }
        break
      case NavTalkMessageType.REALTIME_RESPONSE_AUDIO_TRANSCRIPT_DELTA: {
        const responseId = payload?.id ?? payload?.response_id
        const transcript = payload?.content ?? payload?.delta
        if (responseId && typeof transcript === 'string') {
          const previous = this.responseBuffer.get(responseId) ?? ''
          const next = previous + transcript
          this.responseBuffer.set(responseId, next)
          this.callbacks.onAssistantPartial?.({
            responseId,
            text: next,
          })
          this.setStatus('speaking')
        }
        break
      }
      case NavTalkMessageType.REALTIME_RESPONSE_AUDIO_TRANSCRIPT_DONE: {
        const responseId = payload?.id ?? payload?.response_id
        if (responseId) {
          const text =
            payload?.content ?? payload?.transcript ?? this.responseBuffer.get(responseId) ?? ''
          this.callbacks.onAssistantComplete?.({
            responseId,
            text,
          })
          this.responseBuffer.delete(responseId)
        }
        break
      }
      case NavTalkMessageType.REALTIME_RESPONSE_FUNCTION_CALL_ARGUMENTS_DONE:
        this.handleFunctionCallArguments(payload)
        break
      case NavTalkMessageType.REALTIME_RESPONSE_AUDIO_DONE:
        this.handleAudioResponseComplete()
        break
      case NavTalkMessageType.REALTIME_RESPONSE_AUDIO_DELTA:
        break
      case NavTalkMessageType.WEB_RTC_OFFER:
        void this.handleOffer(payload)
        break
      case NavTalkMessageType.WEB_RTC_ANSWER:
        this.handleAnswer(payload)
        break
      case NavTalkMessageType.WEB_RTC_ICE_CANDIDATE:
        this.handleIceCandidate(payload)
        break
      case NavTalkMessageType.SESSION_GPU_FULL:
        this.callbacks.onError?.('GPU resources are currently busy. Please try again later.')
        break
      case NavTalkMessageType.SESSION_INSUFFICIENT_BALANCE:
        this.callbacks.onError?.('Account balance is insufficient. Please top up to continue.')
        break
      default:
        break
    }
  }

  private sendSessionConfig() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return
    }

    const config = {
      voice: this.voice,
      prompt: this.prompt,
      tools: [
        {
          type: 'function',
          name: 'end_conversation',
          description:
            'Use this when the user says goodbye, wants to leave, or asks to end the interview so the system can hang up automatically after your final response.',
          parameters: {
            type: 'object',
            properties: {
              reason: {
                type: 'string',
                description: 'Brief explanation of why the call should end.',
              },
            },
            required: ['reason'],
          },
        },
      ],
    }

    this.socket.send(
      JSON.stringify({
        type: NavTalkMessageType.REALTIME_INPUT_CONFIG,
        data: { content: JSON.stringify(config) },
      })
    )
  }

  private sendSessionUpdate() {
    // This function is no longer needed for configuration
    // Configuration is now sent via sendSessionConfig in onopen
    // Keep empty for backward compatibility
  }

  public requestAssistantResponse() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return
    }

    try {
      this.socket.send(JSON.stringify({ type: NavTalkMessageType.RESPONSE_CREATE }))
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
            this.socket.send(
              JSON.stringify({
                type: NavTalkMessageType.REALTIME_INPUT_AUDIO_BUFFER_APPEND,
                data: { audio: chunk },
              })
            )
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

  private handleFunctionCallArguments(data: any) {
    const functionName =
      typeof data?.function_name === 'string' ? data.function_name : (data?.name ?? '')
    if (!functionName) {
      return
    }

    const rawCallId = data?.call_id ?? data?.callId ?? data?.id
    const callId = rawCallId != null ? String(rawCallId) : undefined

    let parsedArgs: any = {}
    if (typeof data?.arguments === 'string' && data.arguments.trim().length > 0) {
      try {
        parsedArgs = JSON.parse(data.arguments)
      } catch (error) {
        console.error('Failed to parse function call arguments', error)
      }
    }

    switch (functionName) {
      case 'end_conversation':
        this.handleEndConversation(parsedArgs, callId)
        break
      default:
        break
    }
  }

  private handleEndConversation(args: any, _callId?: string) {
    const reason =
      typeof args?.reason === 'string' && args.reason.trim().length > 0
        ? args.reason.trim()
        : 'User requested to end the conversation.'

    this.callbacks.onAutoHangup?.(reason)
    void this.stop()
  }

  private sendFunctionCallOutput(callId: string, output: Record<string, unknown> | string) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !callId) {
      return
    }

    const serializedOutput = typeof output === 'string' ? output : JSON.stringify(output)

    const payload = {
      type: NavTalkMessageType.CONVERSATION_ITEM_CREATE,
      item: {
        type: 'function_call_output',
        output: serializedOutput,
        call_id: callId,
      },
    }

    try {
      this.socket.send(JSON.stringify(payload))
      this.socket.send(JSON.stringify({ type: NavTalkMessageType.RESPONSE_CREATE }))
    } catch (error) {
      console.error('Failed to send function call output', error)
    }
  }

  private handleAudioResponseComplete() {
    if (!this.pendingHangupReason) {
      return
    }
    const reason = this.pendingHangupReason
    this.pendingHangupReason = null
    this.callbacks.onAutoHangup?.(reason)
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

