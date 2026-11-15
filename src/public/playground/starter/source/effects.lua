-- Native particle emitters handle sparks, landing dust and floating fireflies.
local particles = require('haylen.particles2d')
local Art = require('art')
local Sprites = require('sprites')

local Effects = {}
Effects.__index = Effects

function Effects.new()
    local atlas = Art.atlas('effects/effects')

    -- Emitters are created once and reused rather than recreated on each hit.
    local sparks = particles.newEmitter({
        texture = atlas.texture,
        frames = {atlas:source('sparkle')},
        rate = 0,
        maxParticles = 400,
        lifetime = {0.15, 0.45},
        speed = {100, 480},
        spread = math.pi * 2,
        gravity = {0, 650},
        damping = 2,
        startSize = {12, 28},
        endSize = 0,
        colors = {'#FFFFF3B0', '#FFFFA05C', '#00EC397A'},
        blend = 'additive',
    })

    local dust = particles.newEmitter({
        texture = atlas.texture,
        frames = {atlas:source('dust')},
        rate = 0,
        maxParticles = 120,
        lifetime = {0.2, 0.5},
        speed = {20, 100},
        spread = 2.5,
        startSize = {16, 35},
        endSize = 0,
        damping = 4,
        colors = {'#90E8D8AB', '#00685C46'},
    })

    local fireflies = particles.newEmitter({
        texture = atlas.texture,
        frames = {atlas:source('ember')},
        rate = 18,
        maxParticles = 110,
        lifetime = {2, 4},
        speed = {8, 28},
        shape = 'rectangle',
        shapeSize = {700, 380},
        direction = -1.4,
        spread = 0.8,
        startSize = {7, 15},
        endSize = 0,
        colors = {'#00E3FF83', '#A0E3FF83', '#00E3FF83'},
        blend = 'additive',
    })

    return setmetatable({
        sparks = sparks,
        dust = dust,
        fireflies = fireflies,
        bursts = {},
        totalBursts = 0,
    }, Effects)
end

function Effects:burst(x, y, count, explosion)
    self.totalBursts = self.totalBursts + 1
    self.sparks.x = x
    self.sparks.y = y
    self.sparks:burst(count or 16)

    if explosion and #self.bursts < 24 then
        self.bursts[#self.bursts + 1] = {
            sprite = Sprites.effect('explosion', 0.85),
            x = x,
            y = y,
            life = 0.3,
        }
    end
end

function Effects:land(x, y)
    self.dust.x = x
    self.dust.y = y
    self.dust:burst(10)
end

function Effects:update(deltaTime, camera)
    -- Move the emission area with the camera so the whole level has fireflies.
    self.fireflies.x = camera.position.x
    self.fireflies.y = camera.position.y
    self.sparks:update(deltaTime)
    self.dust:update(deltaTime)
    self.fireflies:update(deltaTime)

    for index = #self.bursts, 1, -1 do
        local burst = self.bursts[index]
        burst.life = burst.life - deltaTime
        burst.sprite:update(deltaTime)

        if burst.life <= 0 then
            table.remove(self.bursts, index)
        end
    end
end

function Effects:draw()
    self.fireflies:draw()
    self.dust:draw()

    for _, burst in ipairs(self.bursts) do
        burst.sprite:draw(burst.x, burst.y)
    end

    self.sparks:draw()
end

function Effects:clear()
    self.sparks:clear()
    self.dust:clear()
    self.fireflies:clear()
    self.bursts = {}
end

return Effects
