// Original score preview only: installed instruments are read in place.
// Exports complete mixes, never samples or game assets. Run with Process Guard.
import Foundation
import AVFoundation
import AudioToolbox
import Darwin
setbuf(stdout, nil)

struct Desk: Decodable { let id: String; let gain: Float; let pan: Float }
struct Note: Decodable { let desk: String; let beat: Double; let length: Double; let key: Int; let velocity: Int }
struct Control: Decodable { let desk: String; let beat: Double; let controller: Int; let value: Int }
struct Score: Decodable {
    let id: String; let title: String; let bpm: Double; let beatsPerBar: Int
    let bars: Int; let tail: Double; let reverb: Float; let roomPreset: String?
    let desks: [Desk]; let notes: [Note]; let controls: [Control]
}
func require(_ condition: Bool, _ message: String) throws {
    if !condition { throw NSError(domain: "OriginalScorePreview", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
}
try require(CommandLine.arguments.count == 3, "Usage: renderer score.json output-directory")
let fm = FileManager.default, source = URL(fileURLWithPath: CommandLine.arguments[1])
let out = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true).standardizedFileURL
try require(out.path.contains("/.agent-run/"), "Preview stays in local ignored evidence directory")
let score = try JSONDecoder().decode(Score.self, from: Data(contentsOf: source))
let scenes = ["summit", "boss", "camp", "garden", "roots", "echo", "library", "mist", "frost", "clockwork", "furnace", "heart", "underworld-roots", "underworld-mist", "underworld-library", "underworld-furnace", "underworld-heart", "garden-identity", "echo-identity", "clockwork-identity", "roots-identity", "library-identity", "mist-identity", "frost-identity", "furnace-identity", "heart-identity", "underworld-roots-identity", "underworld-mist-identity", "underworld-library-identity", "underworld-furnace-identity", "underworld-heart-identity"]
try require(scenes.contains(score.id), "Unknown scene")
try require(score.bpm >= 60 && score.bpm <= 160 && score.bars > 0, "Invalid score tempo")
let secondsPerBeat = 60 / score.bpm, duration = Double(score.bars * score.beatsPerBar) * secondsPerBeat + score.tail
try require(duration >= 45 && duration <= 60, "Preview duration must be 45–60 seconds")
try fm.createDirectory(at: out, withIntermediateDirectories: true)
let logic = "/Library/Application Support/Logic/Sampler Instruments/"
let garage = "/Library/Application Support/GarageBand/Instrument Library/Sampler/Sampler Instruments/iOS Instruments/"
let installed = [
    "violins": logic + "09 Orchestral/09 Strings/String Ensemble.exs",
    "violas": logic + "09 Orchestral/09 Strings/String Ensemble.exs",
    "celli": logic + "09 Orchestral/09 Strings/String Ensemble.exs",
    "flute": garage + "Flute iOS KB.exs", "horn": garage + "French Horn iOS KB.exs",
    "clarinet": garage + "Clarinet iOS KB.exs"
]
let soundBank = "/System/Library/Components/CoreAudio.component/Contents/Resources/gs_instruments.dls"
let bankPrograms: [String: UInt8] = ["harp": 46, "celesta": 8, "vibraphone": 11, "pizzicato": 45, "harpsichord": 6, "bassoon": 70,
    "marimba": 12, "panflute": 75, "oboe": 68, "piano": 0, "trombone": 57, "tuba": 58, "trumpet": 56,
    "choir": 52, "chant": 53, "organ": 19, "englishhorn": 69, "guitar": 24, "contrabass": 43, "mutedtrumpet": 59, "tremolo": 44]
let sampleRate = 44100.0, format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 2)!
let engine = AVAudioEngine(), orchestra = AVAudioMixerNode(), reverb = AVAudioUnitReverb()
engine.attach(orchestra); engine.attach(reverb)
switch score.roomPreset {
case "smallRoom": reverb.loadFactoryPreset(.smallRoom)
case "cathedral": reverb.loadFactoryPreset(.cathedral)
case "mediumHall": reverb.loadFactoryPreset(.mediumHall)
case nil: reverb.loadFactoryPreset(.largeHall)
default: throw NSError(domain: "Instrument", code: 1, userInfo: [NSLocalizedDescriptionKey: "Unsupported room preset"])
}
reverb.wetDryMix = score.reverb
engine.mainMixerNode.outputVolume = 0.62
var samplers: [AVAudioUnitSampler] = [], deskIndex: [String: Int] = [:]
for desk in score.desks {
    try require(deskIndex[desk.id] == nil, "Duplicate instrument desk")
    try require(desk.gain >= -28 && desk.gain <= -8 && abs(desk.pan) <= 1, "Invalid desk level or pan")
    let sampler = AVAudioUnitSampler(); engine.attach(sampler)
    if let path = installed[desk.id] {
        try require(fm.fileExists(atPath: path), "Installed instrument missing; no downloading or fallback")
        try sampler.loadInstrument(at: URL(fileURLWithPath: path))
    } else if let program = bankPrograms[desk.id] {
        try require(score.id.hasSuffix("-identity") && fm.fileExists(atPath: soundBank), "New instruments are local identity auditions only")
        try sampler.loadSoundBankInstrument(at: URL(fileURLWithPath: soundBank), program: program, bankMSB: UInt8(kAUSampler_DefaultMelodicBankMSB), bankLSB: 0)
    } else { throw NSError(domain: "Instrument", code: 1, userInfo: [NSLocalizedDescriptionKey: "Unsupported instrument"]) }
    sampler.overallGain = desk.gain; sampler.stereoPan = desk.pan * 100
    deskIndex[desk.id] = samplers.count; samplers.append(sampler)
    print("Loaded installed section: \(desk.id)")
}
for (i, sampler) in samplers.enumerated() { engine.connect(sampler, to: orchestra, fromBus: 0, toBus: AVAudioNodeBus(i), format: format) }
engine.connect(orchestra, to: reverb, format: format); engine.connect(reverb, to: engine.mainMixerNode, format: format)

struct Event { let frame: Int64; let desk: Int; let kind: Int; let a: UInt8; let b: UInt8 }
var events: [Event] = []
func add(_ seconds: Double, _ desk: Int, _ kind: Int, _ a: Int, _ b: Int = 0) {
    events.append(Event(frame: Int64(max(0, seconds) * sampleRate), desk: desk, kind: kind, a: UInt8(clamping: a), b: UInt8(clamping: b)))
}
for (i, n) in score.notes.enumerated() {
    guard let desk = deskIndex[n.desk] else { throw NSError(domain: "Note", code: 1) }
    try require(n.beat >= 0 && n.length > 0 && n.beat + n.length <= Double(score.bars * score.beatsPerBar) + 0.001, "Invalid note timing")
    try require((0...127).contains(n.key) && (1...127).contains(n.velocity), "Invalid MIDI note")
    let shift = (Double((i * 17) % 9) - 4) * 0.0012, start = max(0, n.beat * secondsPerBeat + shift)
    add(start, desk, 1, n.key, n.velocity); add(start + n.length * secondsPerBeat, desk, 0, n.key)
}
for c in score.controls {
    guard let desk = deskIndex[c.desk] else { throw NSError(domain: "Control", code: 1) }
    try require(c.beat >= 0 && c.beat <= Double(score.bars * score.beatsPerBar) && c.controller == 11 && (0...127).contains(c.value), "Invalid expression event")
    add(c.beat * secondsPerBeat, desk, 2, c.controller, c.value)
}
let priority = [0: 0, 2: 1, 1: 2] // off → phrase expression → new attack
events.sort { $0.frame == $1.frame ? priority[$0.kind]! < priority[$1.kind]! : $0.frame < $1.frame }
try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 1024)
try engine.start(); defer { engine.stop() }
let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 1024)!
let raw = out.appendingPathComponent(score.id + "-orchestra.wav")
var file: AVAudioFile? = try AVAudioFile(forWriting: raw, settings: format.settings)
var cursor: Int64 = 0, next = 0, peak: Float = 0, sum: Double = 0, samples: Int64 = 0, stalls = 0
let frames = Int64(duration * sampleRate)
while cursor < frames {
    while next < events.count && events[next].frame <= cursor {
        let e = events[next], s = samplers[e.desk]
        if e.kind == 1 { s.startNote(e.a, withVelocity: e.b, onChannel: 0) }
        else if e.kind == 0 { s.stopNote(e.a, onChannel: 0) }
        else { s.sendController(e.a, withValue: e.b, onChannel: 0) }
        next += 1
    }
    let boundary = next < events.count ? events[next].frame : frames
    let count = AVAudioFrameCount(min(1024, frames - cursor, max(1, boundary - cursor)))
    let status = try engine.renderOffline(count, to: buffer)
    if status == .success {
        stalls = 0; try require(buffer.frameLength > 0, "Render advanced zero frames")
        for channel in 0..<2 { if let data = buffer.floatChannelData?[channel] {
            for i in 0..<Int(buffer.frameLength) {
                let time = Double(cursor + Int64(i)) / sampleRate
                data[i] *= Float(min(1, time / 0.05) * min(1, max(0, (duration - time) / 2)))
                try require(data[i].isFinite, "Non-finite instrument output")
                peak = max(peak, abs(data[i])); sum += Double(data[i] * data[i]); samples += 1
            }
        }}
        try file?.write(from: buffer); cursor += Int64(buffer.frameLength)
    } else if status == .cannotDoInCurrentContext || status == .insufficientDataFromInputNode {
        stalls += 1; try require(stalls < 100, "Offline renderer stopped advancing")
    } else { throw NSError(domain: "Render", code: 1) }
}
file = nil // Complete the WAVE header before the mastering process reads it.
try require(next == events.count && peak > 0.001 && peak < 0.98, "Incomplete, silent or clipped score")
let receipt: [String: Any] = [
    "title": score.title, "id": score.id, "seconds": duration, "bpm": score.bpm,
    "bars": score.bars, "sampleRate": sampleRate, "channels": 2, "renderedFrames": cursor,
    "noteCount": score.notes.count, "eventCount": events.count, "dispatchedEvents": next,
    "rawPeak": peak, "rawRms": sqrt(sum / Double(max(1, samples))), "file": raw.path,
    "instrumentPaths": score.desks.map { ["desk": $0.id, "installedInstrument": installed[$0.id] ?? soundBank + "#program=" + String(bankPrograms[$0.id]!)] },
    "roomPreset": score.roomPreset ?? "largeHall", "beatsPerBar": score.beatsPerBar,
    "renderMethod": "Original authored score using installed instrument samples; not a live orchestra recording",
    "sourceSamplesRedistributed": false, "officialMusicChanged": false,
    "licenseSources": ["https://www.apple.com/legal/sla/docs/LogicPro.pdf", "https://www.apple.com/legal/sla/docs/GarageBand.pdf"]
]
try JSONSerialization.data(withJSONObject: receipt, options: [.prettyPrinted, .sortedKeys]).write(to: out.appendingPathComponent(score.id + "-render-receipt.json"))
print("Rendered original \(score.id): \(score.notes.count) notes, \(duration) seconds")
