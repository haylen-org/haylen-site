-- The player owns input intentions, movement timers and its character mover.
local input = require('haylen.input')
local physics = require('haylen.physics2d')
local Heroes = require('heroes')
local Sprites = require('sprites')

local Player = {}
Player.__index = Player

-- Edit these values while playing to try Haylen's Lua hot reload.
Player.speed = 330
Player.jumpSpeed = 820
Player.gravity = 1900
Player.dashSpeed = 1100

function Player.new(world, spawn)
    local self = setmetatable({
        x = spawn.x,
        y = spawn.y,
        velocityX = 0,
        velocityY = 0,
        facing = 1,
        aimX = 1,
        aimY = 0,
        usingPointer = false,
        pendingAttack = nil,
        health = 5,
        invulnerable = 0,
        attackCooldown = 0,
        attackPose = 0,
        dashTimer = 0,
        dashCooldown = 0,
        jumps = 0,
        coyoteTime = 0,
        jumpBuffer = 0,
        grounded = false,
        moveAxis = 0,
        attacking = false,
        dashRequested = false,
        hero = 'archer',
        sprite = Sprites.character('archer', 0.82, Heroes.archer),
    }, Player)

    -- The capsule handles slopes, steps and crate pushing in the native world.
    -- Collision categories are terrain = 1, crates = 2, enemies = 4, player = 8.
    self.mover = physics.newMover(world, {
        x = spawn.x,
        y = spawn.y,
        radius = 18,
        height = 120,
        snapDistance = 12,
        stepHeight = 12,
        pushForce = 18000,
        category = 8,
        mask = 3,
    })
    self.mover.body.data = {kind = 'player'}

    return self
end

function Player:chooseHero(name)
    if self.hero == name then
        return
    end

    assert(Heroes[name] ~= nil, 'Unknown hero: ' .. name)

    -- Changing the artwork and weapon keeps the same position and physics body.
    self.hero = name
    self.sprite = Sprites.character(name, 0.82, Heroes[name])
    self.attackCooldown = 0
    self.attackPose = 0
    self.pendingAttack = nil
end

function Player:readInput(camera, controls)
    self.moveAxis = input.value('move')
    self.attacking = input.down('fire')

    -- The right stick aims in any direction independently of the left stick.
    -- Keyboard arrows and pointer aiming remain available without a controller.
    local aimX = input.value('aimX')
    local aimY = input.value('aimY')
    local stickX, stickY = input.vector('aimStick')
    local usingGamepad = input.lastDevice() == 'gamepad'

    if stickX ~= 0 or stickY ~= 0 then
        aimX = stickX
        aimY = stickY
    end

    local pointerDeltaX, pointerDeltaY = input.mouseDelta()
    local pointerMoved = pointerDeltaX ~= 0 or pointerDeltaY ~= 0
    local pointerPressed = input.mousePressed('left')

    -- Ignore the initial pointer position until the player actually uses it.
    if input.mouseInside() and (pointerMoved or pointerPressed) then
        self.usingPointer = true
    end

    local touchAim = controls.aimPoint

    if touchAim ~= nil then
        local worldX, worldY = camera:screenToWorld(touchAim.x, touchAim.y)
        aimX = worldX - self.x
        aimY = worldY - self.y
    elseif aimX == 0 and aimY == 0 and not usingGamepad and self.usingPointer and input.mouseInside() then
        local screenX, screenY = input.mousePosition()
        local worldX, worldY = camera:screenToWorld(screenX, screenY)
        aimX = worldX - self.x
        aimY = worldY - self.y
    end

    local aimLength = math.sqrt(aimX * aimX + aimY * aimY)

    if aimLength > 0.1 then
        self.aimX = aimX / aimLength
        self.aimY = aimY / aimLength
    else
        self.aimX = self.facing
        self.aimY = 0
    end

    -- A short input buffer accepts a jump pressed just before landing.
    if input.pressed('jump') then
        self.jumpBuffer = 0.14
    end

    if input.pressed('dash') then
        self.dashRequested = true
    end

    for index, hero in ipairs(Heroes.order) do
        if input.keyPressed('digit' .. index) then
            self:chooseHero(hero)
        end
    end

    if input.pressed('hero') then
        for index, hero in ipairs(Heroes.order) do
            if self.hero == hero then
                local nextIndex = index % #Heroes.order + 1
                self:chooseHero(Heroes.order[nextIndex])
                break
            end
        end
    end
end

function Player:updateTimers(deltaTime)
    self.attackCooldown = math.max(0, self.attackCooldown - deltaTime)
    self.attackPose = math.max(0, self.attackPose - deltaTime)
    self.invulnerable = math.max(0, self.invulnerable - deltaTime)
    self.dashCooldown = math.max(0, self.dashCooldown - deltaTime)
    self.jumpBuffer = math.max(0, self.jumpBuffer - deltaTime)

    -- Coyote time allows a jump briefly after stepping off an edge.
    if self.grounded then
        self.coyoteTime = 0.12
        self.jumps = 0
    else
        self.coyoteTime = math.max(0, self.coyoteTime - deltaTime)
    end
end

function Player:tryJump(game)
    local canJump = self.coyoteTime > 0 or self.jumps < 2

    if self.jumpBuffer <= 0 or not canJump then
        return
    end

    local strength = 1

    if self.jumps > 0 then
        strength = 0.9
    end

    self.velocityY = -Player.jumpSpeed * strength
    self.jumps = self.jumps + 1
    self.coyoteTime = 0
    self.jumpBuffer = 0

    game.effects:land(self.x, self.y + 60)
    game.sound:play('jump')
end

function Player:tryDash(game)
    if self.dashRequested and self.dashCooldown <= 0 then
        self.dashTimer = 0.16
        self.dashCooldown = 0.85
        self.invulnerable = math.max(self.invulnerable, 0.2)

        game.effects:burst(self.x, self.y, 16)
        game.sound:play('dash')
    end

    -- Consume the request once, even when the cooldown prevented this dash.
    self.dashRequested = false
end

function Player:move(deltaTime, game)
    if self.dashTimer > 0 then
        self.dashTimer = self.dashTimer - deltaTime
        self.velocityX = self.facing * Player.dashSpeed
        self.velocityY = 0
    else
        local targetVelocity = self.moveAxis * Player.speed
        local acceleration = self.grounded and 18 or 10
        local blend = math.min(1, deltaTime * acceleration)

        self.velocityX = self.velocityX + (targetVelocity - self.velocityX) * blend
        self.velocityY = math.min(self.velocityY + Player.gravity * deltaTime, 1200)
    end

    -- Clip before and after moving so walls and ceilings remove blocked velocity.
    local velocity = self.mover:clip(self.velocityX, self.velocityY)
    self.mover:move(velocity.x * deltaTime, velocity.y * deltaTime)
    velocity = self.mover:clip(velocity.x, velocity.y)

    local justLanded = self.mover.grounded and not self.grounded

    self.velocityX = velocity.x
    self.velocityY = velocity.y
    self.x = self.mover.x
    self.y = self.mover.y
    self.grounded = self.mover.grounded

    if justLanded then
        game.effects:land(self.x, self.y + 60)
    end
end

function Player:tryAttack(game)
    if not self.attacking or self.attackCooldown > 0 then
        return
    end

    local hero = Heroes[self.hero]
    self.attackCooldown = hero.attackInterval
    self.attackPose = hero.attackDuration
    self.sprite:attack(hero.attackInterval)

    if hero.weapon == 'sword' then
        game.combat:slash(self)
    else
        -- The animation's release event decides when the weapon fires.
        self.pendingAttack = {hero = hero}
    end

    if hero.weapon == 'sword' then
        game.sound:play('shot')
    end
end

function Player:releaseAttack(game)
    if not self.sprite:consumeRelease() then
        return
    end

    local pending = self.pendingAttack

    if pending == nil then
        return
    end

    -- The native attachment follows the visible pose, scale, trim and facing.
    local launchX, launchY = self.sprite:point('muzzle', self.x, self.y, self.facing)
    assert(launchX ~= nil, 'The release frame needs a muzzle attachment.')
    game.combat:fire(launchX, launchY, self.aimX, self.aimY, false, pending.hero.weapon)
    game.sound:play('shot')
    self.pendingAttack = nil
end

function Player:step(deltaTime, game)
    self:updateTimers(deltaTime)

    if self.attacking and math.abs(self.aimX) > 0.05 then
        self.facing = self.aimX > 0 and 1 or -1
    elseif self.moveAxis > 0 then
        self.facing = 1
    elseif self.moveAxis < 0 then
        self.facing = -1
    end

    self:tryJump(game)
    self:tryDash(game)
    self:move(deltaTime, game)
    self:tryAttack(game)
end

function Player:update(deltaTime, game)
    local animation = 'idle'

    if self.attackPose > 0 then
        animation = 'attack'
    elseif math.abs(self.velocityX) > 30 then
        animation = 'run'
    end

    self.sprite:update(deltaTime, animation)

    -- Haylen updates the scene after fixed steps, so a new shot is drawn at its
    -- weapon attachment before physics advances it on the next frame.
    self:releaseAttack(game)
end

function Player:draw()
    local flash = '#00000000'

    if self.invulnerable > 0 then
        flash = '#80FFFFFF'
    end

    self.sprite:draw(self.x, self.y, self.facing, flash)
end

return Player
