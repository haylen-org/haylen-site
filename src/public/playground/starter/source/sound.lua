-- Short original sounds are generated once, with no audio download required.
local audio = require('haylen.audio')

local Sound = {}
Sound.__index = Sound

local function synthesize(frequency, duration, pitchFall, noiseAmount)
    local sampleRate = 22050
    local sampleCount = math.floor(sampleRate * duration)
    local samples = {}
    local phase = 0
    local noiseSeed = 731

    for index = 1, sampleCount do
        local progress = index / sampleCount
        local currentFrequency = frequency * (1 - pitchFall * progress)
        phase = phase + currentFrequency * 2 * math.pi / sampleRate

        -- A repeatable noise sequence adds texture without changing game randomness.
        noiseSeed = (noiseSeed * 16807) % 2147483647
        local noise = noiseSeed / 1073741823.5 - 1
        local tone = math.sin(phase)
        local wave = tone * (1 - noiseAmount) + noise * noiseAmount

        -- Fade both ends to prevent clicks, then encode one signed PCM sample.
        local attack = math.min(1, progress * 40)
        local release = (1 - progress) ^ 2
        local amplitude = math.floor(wave * attack * release * 10000)
        samples[index] = string.pack('<h', amplitude)
    end

    return audio.newSound(table.concat(samples), {
        format = 'int16',
        sampleRate = sampleRate,
        channels = 1,
    })
end

function Sound.new()
    return setmetatable({
        muted = false,
        sounds = {
            shot = synthesize(1100, 0.12, 0.82, 0.12),
            impact = synthesize(180, 0.16, 0.8, 0.7),
            blast = synthesize(90, 0.4, 0.9, 0.8),
            jump = synthesize(340, 0.18, -0.8, 0.03),
            relic = synthesize(780, 0.35, -0.45, 0),
            hit = synthesize(140, 0.22, 0.7, 0.5),
            dash = synthesize(440, 0.18, 0.7, 0.7),
        },
    }, Sound)
end

function Sound:play(name)
    if self.muted then
        return
    end

    audio.play(self.sounds[name], {volume = 0.45, pitchVariation = 0.06})
end

return Sound
