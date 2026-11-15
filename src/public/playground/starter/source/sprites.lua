-- Haylen reads the animation tags and trim information in the official atlases.
local animation = require('haylen.animation2d')
local graphics = require('haylen.graphics2d')
local Art = require('art')

local Sprites = {}
Sprites.__index = Sprites

local function attackWithMuzzle(atlas, clip, attack)
    assert(#attack.muzzlePoints == clip.frameCount, 'Each attack frame needs a muzzle point.')
    assert(attack.releaseFrame >= 1 and attack.releaseFrame <= clip.frameCount, 'The release frame must exist.')
    local frames = {}

    for index = 1, clip.frameCount do
        local original = clip:frameData(index)
        local muzzle = attack.muzzlePoints[index]
        local events = original.events

        if index == attack.releaseFrame then
            events[#events + 1] = 'release-projectile'
        end

        -- Keep the atlas trim in the pivot when adding native frame attachments.
        -- Points and pivots now share the trimmed frame's local coordinates.
        frames[index] = {
            source = original.source,
            duration = original.duration,
            pivot = {
                original.originalSize.x * 0.5 - original.offset.x,
                original.originalSize.y * 0.5 - original.offset.y,
            },
            points = {
                {
                    name = 'muzzle',
                    x = muzzle.x - original.offset.x,
                    y = muzzle.y - original.offset.y,
                },
            },
            events = events,
        }
    end

    return animation.fromFrames(atlas.texture, frames, {loop = clip.loop})
end

function Sprites.character(name, scale, attack)
    local atlas = Art.atlas('characters/' .. name)
    local animator = animation.newAnimator()

    -- All frames share their original anchor, even when their visible bounds differ.
    animator.pivotY = 0.5

    for _, tag in ipairs(atlas:animationNames()) do
        local clip = atlas:animation(tag)

        if tag == 'attack' and attack ~= nil and attack.muzzlePoints ~= nil then
            clip = attackWithMuzzle(atlas, clip, attack)
        end

        animator:add(tag, clip)
    end

    animator:play('idle')

    local self = setmetatable({
        animator = animator,
        releaseReady = false,
        attackDuration = atlas:animation('attack').duration,
        sprite = graphics.newSprite(atlas.texture, {scaleX = scale, scaleY = scale}),
    }, Sprites)

    animator.onEvent = function(name, event)
        if name == 'attack' and event == 'release-projectile' then
            self.releaseReady = true
        end
    end

    return self
end

function Sprites.effect(name, scale)
    local atlas = Art.atlas('effects/effects')
    local frames = {}
    local frameNumber = 1

    -- Effect frames have readable names such as explosion_1 and explosion_2.
    while atlas:hasFrame(name .. '_' .. frameNumber) do
        frames[#frames + 1] = atlas:source(name .. '_' .. frameNumber)
        frameNumber = frameNumber + 1
    end

    assert(#frames > 0, 'Unknown effect: ' .. name)

    local animator = animation.newAnimator()
    animator:add('play', animation.fromFrames(atlas.texture, frames, {
        framesPerSecond = 20,
        loop = 'once',
    }))
    animator:play('play')

    return setmetatable({
        animator = animator,
        sprite = graphics.newSprite(atlas.texture, {scaleX = scale, scaleY = scale}),
    }, Sprites)
end

function Sprites:attack(duration)
    -- Fit the complete painted attack into the weapon's timing before the next swing.
    self.animator.speed = self.attackDuration / duration
    self.releaseReady = false
    self.animator:play('attack', true)
end

function Sprites:update(deltaTime, state)
    if state ~= nil then
        if state ~= 'attack' then
            self.animator.speed = 1
        end

        self.animator:play(state)
    end

    self.animator:update(deltaTime)
    self.animator:apply(self.sprite)
end

function Sprites:place(x, y, facing)
    self.sprite.x = x
    self.sprite.y = y
    self.sprite.flipHorizontal = facing == -1
    self.animator:apply(self.sprite)
end

function Sprites:point(name, x, y, facing)
    self:place(x, y, facing)
    return self.animator:point(name, self.sprite)
end

function Sprites:consumeRelease()
    local ready = self.releaseReady
    self.releaseReady = false
    return ready
end

function Sprites:draw(x, y, facing, flash)
    self:place(x, y, facing)
    self.sprite.flash = flash or '#00000000'
    self.sprite:draw()
end

return Sprites
