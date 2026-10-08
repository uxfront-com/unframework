// The browser's globals (ADR-0045): every name lib.dom declares, which client code may read (a
// handler, a watcher's callback, `watchEffect`, a lifecycle hook and the local functions they
// call: code every target runs only in the browser, and prints as written), and the `window`
// members it reads only through `window`. The analyser reports a name outside them (UF3020),
// and `checkInvariants` rejects one in any IR.
//
// Source: TypeScript 7.0.2's `lib.dom.d.ts`, its `declare var`, `declare function` and
// `declare namespace` names, which TypeScript 6.0.2's, the checker of the Vue, Svelte, Astro and
// Angular outputs, matches. The analyser's `globals-conformance` test pins both.

import { words } from "./tables.ts";

/** Every global lib.dom declares: its interfaces' constructors, its functions, `window`'s members. */
export const LIB_DOM_GLOBALS: ReadonlySet<string> = words(`
  AbortController AbortSignal AbstractRange AnalyserNode Animation AnimationEffect AnimationEvent
  AnimationPlaybackEvent AnimationTimeline Attr Audio AudioBuffer AudioBufferSourceNode
  AudioContext AudioData AudioDecoder AudioDestinationNode AudioEncoder AudioListener AudioNode
  AudioParam AudioParamMap AudioProcessingEvent AudioScheduledSourceNode AudioWorklet
  AudioWorkletNode AuthenticatorAssertionResponse AuthenticatorAttestationResponse
  AuthenticatorResponse BarProp BaseAudioContext BeforeUnloadEvent BiquadFilterNode Blob BlobEvent
  BroadcastChannel ByteLengthQueuingStrategy CDATASection CSS CSSAnimation CSSConditionRule
  CSSContainerRule CSSCounterStyleRule CSSFontFaceRule CSSFontFeatureValuesRule
  CSSFontPaletteValuesRule CSSGroupingRule CSSImageValue CSSImportRule CSSKeyframeRule
  CSSKeyframesRule CSSKeywordValue CSSLayerBlockRule CSSLayerStatementRule CSSMathClamp
  CSSMathInvert CSSMathMax CSSMathMin CSSMathNegate CSSMathProduct CSSMathSum CSSMathValue
  CSSMatrixComponent CSSMediaRule CSSNamespaceRule CSSNestedDeclarations CSSNumericArray
  CSSNumericValue CSSPageDescriptors CSSPageRule CSSPerspective CSSPositionTryDescriptors
  CSSPositionTryRule CSSPropertyRule CSSRotate CSSRule CSSRuleList CSSScale CSSScopeRule CSSSkew
  CSSSkewX CSSSkewY CSSStartingStyleRule CSSStyleDeclaration CSSStyleProperties CSSStyleRule
  CSSStyleSheet CSSStyleValue CSSSupportsRule CSSTransformComponent CSSTransformValue CSSTransition
  CSSTranslate CSSUnitValue CSSUnparsedValue CSSVariableReferenceValue CSSViewTransitionRule Cache
  CacheStorage CanvasCaptureMediaStreamTrack CanvasGradient CanvasPattern CanvasRenderingContext2D
  CaretPosition ChannelMergerNode ChannelSplitterNode CharacterData Clipboard ClipboardEvent
  ClipboardItem CloseEvent CommandEvent Comment CompositionEvent CompressionStream
  ConstantSourceNode ContentVisibilityAutoStateChangeEvent ConvolverNode CookieChangeEvent
  CookieStore CookieStoreManager CountQueuingStrategy Credential CredentialsContainer Crypto
  CryptoKey CustomElementRegistry CustomEvent CustomStateSet DOMException DOMImplementation
  DOMMatrix DOMMatrixReadOnly DOMParser DOMPoint DOMPointReadOnly DOMQuad DOMRect DOMRectList
  DOMRectReadOnly DOMStringList DOMStringMap DOMTokenList DataTransfer DataTransferItem
  DataTransferItemList DecompressionStream DelayNode DeviceMotionEvent DeviceOrientationEvent
  DigitalCredential Document DocumentFragment DocumentTimeline DocumentType DragEvent
  DynamicsCompressorNode Element ElementInternals EncodedAudioChunk EncodedVideoChunk ErrorEvent
  Event EventCounts EventSource EventTarget External File FileList FileReader FileSystem
  FileSystemDirectoryEntry FileSystemDirectoryHandle FileSystemDirectoryReader FileSystemEntry
  FileSystemFileEntry FileSystemFileHandle FileSystemHandle FileSystemWritableFileStream FocusEvent
  FontFace FontFaceSet FontFaceSetLoadEvent FormData FormDataEvent FragmentDirective GPU GPUAdapter
  GPUAdapterInfo GPUBindGroup GPUBindGroupLayout GPUBuffer GPUCanvasContext GPUCommandBuffer
  GPUCommandEncoder GPUCompilationInfo GPUCompilationMessage GPUComputePassEncoder
  GPUComputePipeline GPUDevice GPUDeviceLostInfo GPUError GPUExternalTexture GPUInternalError
  GPUOutOfMemoryError GPUPipelineError GPUPipelineLayout GPUQuerySet GPUQueue GPURenderBundle
  GPURenderBundleEncoder GPURenderPassEncoder GPURenderPipeline GPUSampler GPUShaderModule
  GPUSupportedFeatures GPUSupportedLimits GPUTexture GPUTextureView GPUUncapturedErrorEvent
  GPUValidationError GainNode Gamepad GamepadButton GamepadEvent GamepadHapticActuator Geolocation
  GeolocationCoordinates GeolocationPosition GeolocationPositionError HTMLAllCollection
  HTMLAnchorElement HTMLAreaElement HTMLAudioElement HTMLBRElement HTMLBaseElement HTMLBodyElement
  HTMLButtonElement HTMLCanvasElement HTMLCollection HTMLDListElement HTMLDataElement
  HTMLDataListElement HTMLDetailsElement HTMLDialogElement HTMLDirectoryElement HTMLDivElement
  HTMLDocument HTMLElement HTMLEmbedElement HTMLFieldSetElement HTMLFontElement
  HTMLFormControlsCollection HTMLFormElement HTMLFrameElement HTMLFrameSetElement HTMLHRElement
  HTMLHeadElement HTMLHeadingElement HTMLHtmlElement HTMLIFrameElement HTMLImageElement
  HTMLInputElement HTMLLIElement HTMLLabelElement HTMLLegendElement HTMLLinkElement HTMLMapElement
  HTMLMarqueeElement HTMLMediaElement HTMLMenuElement HTMLMetaElement HTMLMeterElement
  HTMLModElement HTMLOListElement HTMLObjectElement HTMLOptGroupElement HTMLOptionElement
  HTMLOptionsCollection HTMLOutputElement HTMLParagraphElement HTMLParamElement HTMLPictureElement
  HTMLPreElement HTMLProgressElement HTMLQuoteElement HTMLScriptElement HTMLSelectElement
  HTMLSlotElement HTMLSourceElement HTMLSpanElement HTMLStyleElement HTMLTableCaptionElement
  HTMLTableCellElement HTMLTableColElement HTMLTableElement HTMLTableRowElement
  HTMLTableSectionElement HTMLTemplateElement HTMLTextAreaElement HTMLTimeElement HTMLTitleElement
  HTMLTrackElement HTMLUListElement HTMLUnknownElement HTMLVideoElement HashChangeEvent Headers
  Highlight HighlightRegistry History IDBCursor IDBCursorWithValue IDBDatabase IDBFactory IDBIndex
  IDBKeyRange IDBObjectStore IDBOpenDBRequest IDBRequest IDBTransaction IDBVersionChangeEvent
  IIRFilterNode IdleDeadline Image ImageBitmap ImageBitmapRenderingContext ImageCapture ImageData
  ImageDecoder ImageTrack ImageTrackList InputDeviceInfo InputEvent IntersectionObserver
  IntersectionObserverEntry KeyboardEvent KeyframeEffect LargestContentfulPaint Location Lock
  LockManager MIDIAccess MIDIConnectionEvent MIDIInput MIDIInputMap MIDIMessageEvent MIDIOutput
  MIDIOutputMap MIDIPort MathMLElement MediaCapabilities MediaDeviceInfo MediaDevices
  MediaElementAudioSourceNode MediaEncryptedEvent MediaError MediaKeyMessageEvent MediaKeySession
  MediaKeyStatusMap MediaKeySystemAccess MediaKeys MediaList MediaMetadata MediaQueryList
  MediaQueryListEvent MediaRecorder MediaSession MediaSource MediaSourceHandle MediaStream
  MediaStreamAudioDestinationNode MediaStreamAudioSourceNode MediaStreamTrack MediaStreamTrackEvent
  MessageChannel MessageEvent MessagePort MimeType MimeTypeArray MouseEvent MutationObserver
  MutationRecord NamedNodeMap NavigateEvent Navigation NavigationActivation
  NavigationCurrentEntryChangeEvent NavigationDestination NavigationHistoryEntry
  NavigationPrecommitController NavigationPreloadManager NavigationTransition Navigator
  NavigatorLogin Node NodeFilter NodeIterator NodeList Notification OfflineAudioCompletionEvent
  OfflineAudioContext OffscreenCanvas OffscreenCanvasRenderingContext2D Option OscillatorNode
  OverconstrainedError PageRevealEvent PageSwapEvent PageTransitionEvent PannerNode Path2D
  PaymentAddress PaymentMethodChangeEvent PaymentRequest PaymentRequestUpdateEvent PaymentResponse
  Performance PerformanceEntry PerformanceEventTiming PerformanceMark PerformanceMeasure
  PerformanceNavigation PerformanceNavigationTiming PerformanceObserver
  PerformanceObserverEntryList PerformancePaintTiming PerformanceResourceTiming
  PerformanceServerTiming PerformanceTiming PeriodicWave PermissionStatus Permissions
  PictureInPictureEvent PictureInPictureWindow Plugin PluginArray PointerEvent PopStateEvent
  ProcessingInstruction ProgressEvent PromiseRejectionEvent PublicKeyCredential PushManager
  PushSubscription PushSubscriptionOptions RTCCertificate RTCDTMFSender RTCDTMFToneChangeEvent
  RTCDataChannel RTCDataChannelEvent RTCDtlsTransport RTCEncodedAudioFrame RTCEncodedVideoFrame
  RTCError RTCErrorEvent RTCIceCandidate RTCIceTransport RTCPeerConnection
  RTCPeerConnectionIceErrorEvent RTCPeerConnectionIceEvent RTCRtpReceiver RTCRtpScriptTransform
  RTCRtpSender RTCRtpTransceiver RTCSctpTransport RTCSessionDescription RTCStatsReport
  RTCTrackEvent RadioNodeList Range ReadableByteStreamController ReadableStream
  ReadableStreamBYOBReader ReadableStreamBYOBRequest ReadableStreamDefaultController
  ReadableStreamDefaultReader RemotePlayback ReportingObserver Request ResizeObserver
  ResizeObserverEntry ResizeObserverSize Response SVGAElement SVGAngle SVGAnimateElement
  SVGAnimateMotionElement SVGAnimateTransformElement SVGAnimatedAngle SVGAnimatedBoolean
  SVGAnimatedEnumeration SVGAnimatedInteger SVGAnimatedLength SVGAnimatedLengthList
  SVGAnimatedNumber SVGAnimatedNumberList SVGAnimatedPreserveAspectRatio SVGAnimatedRect
  SVGAnimatedString SVGAnimatedTransformList SVGAnimationElement SVGCircleElement
  SVGClipPathElement SVGComponentTransferFunctionElement SVGDefsElement SVGDescElement SVGElement
  SVGEllipseElement SVGFEBlendElement SVGFEColorMatrixElement SVGFEComponentTransferElement
  SVGFECompositeElement SVGFEConvolveMatrixElement SVGFEDiffuseLightingElement
  SVGFEDisplacementMapElement SVGFEDistantLightElement SVGFEDropShadowElement SVGFEFloodElement
  SVGFEFuncAElement SVGFEFuncBElement SVGFEFuncGElement SVGFEFuncRElement SVGFEGaussianBlurElement
  SVGFEImageElement SVGFEMergeElement SVGFEMergeNodeElement SVGFEMorphologyElement
  SVGFEOffsetElement SVGFEPointLightElement SVGFESpecularLightingElement SVGFESpotLightElement
  SVGFETileElement SVGFETurbulenceElement SVGFilterElement SVGForeignObjectElement SVGGElement
  SVGGeometryElement SVGGradientElement SVGGraphicsElement SVGImageElement SVGLength SVGLengthList
  SVGLineElement SVGLinearGradientElement SVGMPathElement SVGMarkerElement SVGMaskElement SVGMatrix
  SVGMetadataElement SVGNumber SVGNumberList SVGPathElement SVGPatternElement SVGPoint SVGPointList
  SVGPolygonElement SVGPolylineElement SVGPreserveAspectRatio SVGRadialGradientElement SVGRect
  SVGRectElement SVGSVGElement SVGScriptElement SVGSetElement SVGStopElement SVGStringList
  SVGStyleElement SVGSwitchElement SVGSymbolElement SVGTSpanElement SVGTextContentElement
  SVGTextElement SVGTextPathElement SVGTextPositioningElement SVGTitleElement SVGTransform
  SVGTransformList SVGUnitTypes SVGUseElement SVGViewElement Sanitizer Scheduler Screen
  ScreenOrientation ScriptProcessorNode ScrollTimeline SecurityPolicyViolationEvent Selection
  ServiceWorker ServiceWorkerContainer ServiceWorkerRegistration ShadowRoot SharedWorker
  SourceBuffer SourceBufferList SpeechRecognitionAlternative SpeechRecognitionErrorEvent
  SpeechRecognitionEvent SpeechRecognitionResult SpeechRecognitionResultList SpeechSynthesis
  SpeechSynthesisErrorEvent SpeechSynthesisEvent SpeechSynthesisUtterance SpeechSynthesisVoice
  StaticRange StereoPannerNode Storage StorageEvent StorageManager StylePropertyMap
  StylePropertyMapReadOnly StyleSheet StyleSheetList SubmitEvent SubtleCrypto TaskController
  TaskPriorityChangeEvent TaskSignal Text TextDecoder TextDecoderStream TextEncoder
  TextEncoderStream TextEvent TextMetrics TextTrack TextTrackCue TextTrackCueList TextTrackList
  TimeRanges ToggleEvent Touch TouchEvent TouchList TrackEvent TransformStream
  TransformStreamDefaultController TransitionEvent TreeWalker UIEvent URL URLPattern
  URLSearchParams UserActivation VTTCue VTTRegion ValidityState VideoColorSpace VideoDecoder
  VideoEncoder VideoFrame VideoPlaybackQuality ViewTimeline ViewTransition ViewTransitionTypeSet
  VisualViewport WGSLLanguageFeatures WakeLock WakeLockSentinel WaveShaperNode WebAssembly
  WebGL2RenderingContext WebGLActiveInfo WebGLBuffer WebGLContextEvent WebGLFramebuffer
  WebGLProgram WebGLQuery WebGLRenderbuffer WebGLRenderingContext WebGLSampler WebGLShader
  WebGLShaderPrecisionFormat WebGLSync WebGLTexture WebGLTransformFeedback WebGLUniformLocation
  WebGLVertexArrayObject WebKitCSSMatrix WebSocket WebTransport WebTransportBidirectionalStream
  WebTransportDatagramDuplexStream WebTransportError WheelEvent Window Worker Worklet
  WritableStream WritableStreamDefaultController WritableStreamDefaultWriter XMLDocument
  XMLHttpRequest XMLHttpRequestEventTarget XMLHttpRequestUpload XMLSerializer XPathEvaluator
  XPathExpression XPathResult XSLTProcessor addEventListener alert atob blur btoa caches
  cancelAnimationFrame cancelIdleCallback captureEvents clearInterval clearTimeout
  clientInformation close closed confirm console cookieStore createImageBitmap crossOriginIsolated
  crypto customElements devicePixelRatio dispatchEvent document event external fetch focus
  frameElement frames getComputedStyle getSelection history indexedDB innerHeight innerWidth
  isSecureContext length localStorage location locationbar matchMedia menubar moveBy moveTo name
  navigation navigator onabort onafterprint onanimationcancel onanimationend onanimationiteration
  onanimationstart onauxclick onbeforeinput onbeforematch onbeforeprint onbeforetoggle
  onbeforeunload onblur oncancel oncanplay oncanplaythrough onchange onclick onclose oncommand
  oncontextlost oncontextmenu oncontextrestored oncopy oncuechange oncut ondblclick ondevicemotion
  ondeviceorientation ondeviceorientationabsolute ondrag ondragend ondragenter ondragleave
  ondragover ondragstart ondrop ondurationchange onemptied onended onerror onfocus onformdata
  ongamepadconnected ongamepaddisconnected ongotpointercapture onhashchange oninput oninvalid
  onkeydown onkeypress onkeyup onlanguagechange onload onloadeddata onloadedmetadata onloadstart
  onlostpointercapture onmessage onmessageerror onmousedown onmouseenter onmouseleave onmousemove
  onmouseout onmouseover onmouseup onoffline ononline onorientationchange onpagehide onpagereveal
  onpageshow onpageswap onpaste onpause onplay onplaying onpointercancel onpointerdown
  onpointerenter onpointerleave onpointermove onpointerout onpointerover onpointerrawupdate
  onpointerup onpopstate onprogress onratechange onrejectionhandled onreset onresize onscroll
  onscrollend onsecuritypolicyviolation onseeked onseeking onselect onselectionchange onselectstart
  onslotchange onstalled onstorage onsubmit onsuspend ontimeupdate ontoggle ontouchcancel
  ontouchend ontouchmove ontouchstart ontransitioncancel ontransitionend ontransitionrun
  ontransitionstart onunhandledrejection onunload onvolumechange onwaiting onwebkitanimationend
  onwebkitanimationiteration onwebkitanimationstart onwebkittransitionend onwheel open opener
  orientation origin originAgentCluster outerHeight outerWidth pageXOffset pageYOffset parent
  performance personalbar postMessage print prompt queueMicrotask releaseEvents removeEventListener
  reportError requestAnimationFrame requestIdleCallback resizeBy resizeTo scheduler screen
  screenLeft screenTop screenX screenY scroll scrollBy scrollTo scrollX scrollY scrollbars self
  sessionStorage setInterval setTimeout speechSynthesis status statusbar stop structuredClone
  toString toolbar top visualViewport webkitURL window
`);

/**
 * The `window` members client code reads through `window` (`window.innerWidth`), never bare: a
 * name that reads like a component's own (`name`, `status`, `top`, `length`, `event`, `open`,
 * `close`, `focus`, `scrollY`) and is `window`'s where nothing declares it, so a missing
 * declaration or a typo would read the window silently. They are the confusing browser globals
 * of eslint's `no-restricted-globals` lists (create-react-app's `confusing-browser-globals`)
 * that lib.dom declares, but `history`, `location` and `confirm`, which client code names bare
 * (`new URLSearchParams(location.search)`); the `on…` event handler properties; and lib.dom's
 * other members of that kind (`dispatchEvent`, `postMessage`, `origin`, `orientation`,
 * `clientInformation`, `personalbar`, `captureEvents`, `releaseEvents`, `toString`). UF3020's
 * likely fix writes `window.` before one.
 */
export const WINDOW_MEMBER_GLOBALS: ReadonlySet<string> = new Set([
  ...words(`
    addEventListener blur captureEvents clientInformation close closed dispatchEvent event
    external focus frameElement frames innerHeight innerWidth length locationbar menubar moveBy
    moveTo name open opener orientation origin outerHeight outerWidth pageXOffset pageYOffset
    parent personalbar postMessage print releaseEvents removeEventListener resizeBy resizeTo
    screen screenLeft screenTop screenX screenY scroll scrollBy scrollTo scrollX scrollY
    scrollbars self status statusbar stop toString toolbar top
  `),
  ...[...LIB_DOM_GLOBALS].filter((name) => /^on[a-z]/.test(name)),
]);
