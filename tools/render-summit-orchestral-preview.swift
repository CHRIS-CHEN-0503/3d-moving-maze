// Original cloud-summit score. Reads the Mac's already installed instrument library.
// Only a mixed original composition is exported; no sample/instrument is copied.
// Run with Process Guard. This never edits assets/music or the music controller.
import Foundation
import AVFoundation
import AudioToolbox
import Darwin
setbuf(stdout, nil)

let fm = FileManager.default
let out = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ".agent-run/summit-orchestra-preview", isDirectory: true)
try fm.createDirectory(at: out, withIntermediateDirectories: true)
let sampleRate = 44100.0
let beat = 60.0 / 80.0
let duration = 40.0
let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 2)!
let engine = AVAudioEngine()
let orchestra = AVAudioMixerNode()
let reverb = AVAudioUnitReverb()
reverb.loadFactoryPreset(.largeHall)
reverb.wetDryMix = 23
engine.attach(reverb)
engine.attach(orchestra)
engine.mainMixerNode.outputVolume = 0.58
let instruments = "/Library/Application Support/Logic/Sampler Instruments/"
let gb = "/Library/Application Support/GarageBand/Instrument Library/Sampler/Sampler Instruments/iOS Instruments/"
struct Desk { let id: String; let file: String; let gain: Float; let pan: Float }
let desks = [
    Desk(id:"violins", file:instruments+"09 Orchestral/09 Strings/String Ensemble.exs", gain:-13, pan:-0.36),
    Desk(id:"violas", file:instruments+"09 Orchestral/09 Strings/String Ensemble.exs", gain:-16, pan:0.32),
    Desk(id:"celli", file:instruments+"09 Orchestral/09 Strings/String Ensemble.exs", gain:-13.5, pan:0.16),
    Desk(id:"flute", file:gb+"Flute iOS KB.exs", gain:-15, pan:-0.12),
    Desk(id:"horn", file:gb+"French Horn iOS KB.exs", gain:-18, pan:0.23),
    Desk(id:"clarinet", file:gb+"Clarinet iOS KB.exs", gain:-21, pan:-0.24)
]
var samplers: [AVAudioUnitSampler] = []
for desk in desks {
    guard fm.fileExists(atPath: desk.file) else { fatalError("Installed instrument missing: \(desk.file). No download fallback.") }
    let sampler = AVAudioUnitSampler()
    engine.attach(sampler)
    // Load and verify each installed instrument before connecting the graph.
    do { try sampler.loadInstrument(at: URL(fileURLWithPath: desk.file)) }
    catch { print("Instrument load failed: \(desk.id): \(error)"); exit(1) }
    sampler.overallGain = desk.gain
    sampler.stereoPan = desk.pan * 100
    samplers.append(sampler)
    print("Loaded installed instrument: \(desk.id)")
}
// Each instrument has its own input on a shared premix; connecting multiple
// source nodes to one effect input directly would replace the previous source.
for (i,sampler) in samplers.enumerated() {
    engine.connect(sampler, to: orchestra, fromBus: 0, toBus: AVAudioNodeBus(i), format: format)
}
engine.connect(orchestra, to: reverb, format: format)
engine.connect(reverb, to: engine.mainMixerNode, format: format)

struct Event { let frame: Int64; let desk: Int; let kind: Int; let a: UInt8; let b: UInt8 }
var events: [Event] = []
var noteCount = 0
func event(_ seconds: Double, _ desk: Int, _ kind: Int, _ a: Int, _ b: Int = 0) {
    events.append(Event(frame:Int64(max(0,seconds)*sampleRate),desk:desk,kind:kind,a:UInt8(clamping:a),b:UInt8(clamping:b)))
}
func note(_ desk: Int, _ startBeat: Double, _ length: Double, _ key: Int, _ velocity: Int) {
    let offset = (Double((noteCount*17)%9)-4)*0.0015
    let start = max(0,startBeat*beat+offset)
    event(start,desk,1,key,velocity)
    event(start+length*beat,desk,0,key)
    noteCount += 1
}
// Twelve original four-beat bars: uncertainty -> opening clouds -> warm arrival.
// Deliberate common-tone voicing and a minor-to-major final phrase; no borrowed melody.
let harmony: [[Int]] = [
    [50,57,60,64,69], [46,53,57,62,65], [41,53,57,60,67], [48,55,60,62,67],
    [43,50,57,58,65], [46,53,57,62,65], [45,53,57,60,64], [45,52,55,61,64],
    [50,57,61,64,69], [43,54,57,62,69], [45,52,59,61,64], [38,50,57,59,66]
]
let melody: [[(Double,Double,Int)]] = [
    [(0.4,1.5,74),(2.2,1.25,76)], [(0,2.5,77),(2.7,0.7,74)],
    [(0.2,1.6,72),(2,1.35,79)], [(0,1.4,76),(1.8,1.7,74)],
    [(0.2,1.35,77),(1.8,0.7,79),(2.6,1,81)], [(0,2.3,77),(2.6,1,74)],
    [(0.2,1.2,76),(1.7,1.6,77)], [(0,1.4,76),(1.8,1.6,73)],
    [(0.1,1.5,78),(1.9,1.5,81)], [(0,2.2,83),(2.6,1,81)],
    [(0,1.15,80),(1.45,0.75,76),(2.5,1,73)], [(0,3.5,74)]
]
for bar in 0..<12 {
    let t = Double(bar*4), chord = harmony[bar], energy = bar < 4 ? 0 : bar < 8 ? 7 : 16
    // Long-bow sections retain breathing room and overlap only at genuine legato joins.
    note(2,t,3.94,chord[0],49+energy)
    note(1,t+0.06,3.85,chord[1],43+energy)
    note(1,t+0.09,3.78,chord[2],42+energy)
    note(0,t+0.08,3.83,chord[3]+12,44+energy)
    note(0,t+0.11,3.78,chord[4]+12,39+energy)
    for (at,len,key) in melody[bar] { note(3,t+at,len,key,61+(bar>=8 ? 8:0)) }
    if bar>=4 {
        note(4,t+0.15,3.45,chord[2],bar>=8 ? 66:50)
        if bar>=8 { note(4,t+0.19,3.35,chord[3],55) }
    }
    if bar%2==1 && bar<8 {
        note(5,t+2.4,1.3,chord[2]+12,53)
    }
    // Bow/horn expression swells through each phrase rather than a static held chord.
    for desk in [0,1,2,4] {
        for step in 0...8 {
            let p=Double(step)/8, lift=sin(p*Double.pi)
            event((t+p*3.92)*beat,desk,2,11,Int(72+Double(energy)+lift*16))
        }
    }
}
events.sort { $0.frame == $1.frame ? $0.kind < $1.kind : $0.frame < $1.frame }
try engine.enableManualRenderingMode(.offline, format:format, maximumFrameCount:1024)
try engine.start()
defer { engine.stop() }
let buffer=AVAudioPCMBuffer(pcmFormat:format, frameCapacity:1024)!
let raw=out.appendingPathComponent("cloud-summit-orchestra-original.wav")
var file:AVAudioFile?=try AVAudioFile(forWriting:raw, settings:format.settings)
var cursor:Int64=0, next=0, peak:Float=0, sum:Double=0, sampleCount:Int64=0
let frames=Int64(duration*sampleRate)
var stalls=0
while cursor<frames {
    while next<events.count && events[next].frame<=cursor {
        let e=events[next],s=samplers[e.desk]
        if e.kind==1 { s.startNote(e.a, withVelocity:e.b, onChannel:0) }
        else if e.kind==0 { s.stopNote(e.a,onChannel:0) }
        else { s.sendController(e.a,withValue:e.b,onChannel:0) }
        next += 1
    }
    let boundary=next<events.count ? events[next].frame:frames
    let count=AVAudioFrameCount(min(1024,frames-cursor,max(1,boundary-cursor)))
    let status=try engine.renderOffline(count,to:buffer)
    if status == .success {
        stalls=0
        let n=Int(buffer.frameLength)
        for channel in 0..<2 { if let samples=buffer.floatChannelData?[channel] {
            for i in 0..<n {
                let second=Double(cursor+Int64(i))/sampleRate
                // Natural ending, with a gentle final-tail fade and a click-free start.
                let fade=min(1,second/0.045)*min(1,max(0,(duration-second)/2.0))
                samples[i] *= Float(fade)
                peak=max(peak,abs(samples[i]));sum+=Double(samples[i]*samples[i]);sampleCount+=1
            }
        }}
        try file?.write(from:buffer);cursor+=Int64(buffer.frameLength)
    } else if status == .cannotDoInCurrentContext || status == .insufficientDataFromInputNode {
        stalls+=1;if stalls>100 { fatalError("Offline render did not advance") }
    } else { fatalError("Audio engine render error") }
}
// Finalize the WAVE header before another tool reads the output.
file=nil
let metadata:[String:Any]=[
    "title":"雲海之門・原創管弦試聽", "seconds":duration,"bpm":80,"bars":12,
    "format":"sample-based orchestral arrangement, not a live orchestra recording",
    "creativeScope":"Original melody, harmony, notes, orchestration and expression; no borrowed tune or audio loop",
    "license":"Installed GarageBand instrument sample content used only in a complete original soundtrack; no source samples redistributed",
    "licenseSource":"https://www.apple.com/legal/sla/docs/GarageBand.pdf",
    "instrumentCount":desks.count,"noteCount":noteCount,"peak":peak,"rms":sqrt(sum/Double(max(1,sampleCount))),
    "renderedFrames":cursor,"sampleRate":sampleRate,"channels":2,"rawFile":raw.path,
    "instruments":desks.map { ["part":$0.id,"installedInstrument":$0.file] }
]
let json=try JSONSerialization.data(withJSONObject:metadata,options:[.prettyPrinted,.sortedKeys])
try json.write(to:out.appendingPathComponent("score-receipt.json"))
guard peak>0.001 && peak<1 else { fatalError("Master peak invalid: \(peak)") }
print("Original score rendered: \(noteCount) notes, \(duration) seconds, peak \(peak)")
print(raw.path)
