-- Combat owns projectiles and resolves their hits against the native world.
local graphics = require('haylen.graphics2d')
local Art = require('art')
local Sprites = require('sprites')

local Combat = {}
Combat.__index = Combat

function Combat.new(game)
    return setmetatable({
        game = game,
        projectiles = {},
        slashes = {},
        shotsFired = 0,
        hits = 0,
    }, Combat)
end

function Combat:fire(x, y, directionX, directionY, hostile, weapon)
    -- Bound the active effects even when someone holds Attack continuously.
    if #self.projectiles >= 100 then
        return
    end

    local speed = 1500

    if hostile then
        speed = 380
    elseif weapon == 'fireball' then
        speed = 1100
    end

    local projectile = {
        x = x,
        y = y,
        velocityX = directionX * speed,
        velocityY = directionY * speed,
        life = hostile and 3 or 0.9,
        hostile = hostile,
        weapon = weapon,
        damage = weapon == 'fireball' and 2 or 1,
    }

    -- Include the segment from the hero to the muzzle on the first ray cast.
    -- Otherwise a muzzle already inside a crate would let the shot pass through it.
    if not hostile then
        projectile.firstCastX = self.game.player.x
        self.shotsFired = self.shotsFired + 1
        self.game.effects:burst(x, y, 4)
    end

    self.projectiles[#self.projectiles + 1] = projectile
end

function Combat:slash(player)
    local slashX = player.x + player.facing * 65
    self.slashes[#self.slashes + 1] = {
        sprite = Sprites.effect('slash', 1),
        x = slashX,
        y = player.y - 10,
        facing = player.facing,
        life = 0.2,
    }

    -- A sword hits nearby targets in front of the hero once per swing.
    for _, enemy in ipairs(self.game.enemies) do
        local distanceAhead = (enemy.x - player.x) * player.facing
        local heightDifference = math.abs(enemy.y - player.y)

        if enemy.alive and distanceAhead > 0 and distanceAhead < 170 and heightDifference < 100 then
            enemy:hit(self.game, 2)
            self.game.effects:burst(enemy.x, enemy.y, 18)
        end
    end

    for _, crate in ipairs(self.game.world.crates) do
        if crate.body.valid then
            local distanceAhead = (crate.body.x - player.x) * player.facing
            local heightDifference = math.abs(crate.body.y - player.y)

            if distanceAhead > 0 and distanceAhead < 155 and heightDifference < 100 then
                self.game.world:hitCrate(crate, player.facing, self.game)
            end
        end
    end
end

function Combat:resolveHit(projectile, hit)
    local game = self.game
    local target = hit.body.data
    self.hits = self.hits + 1

    if target ~= nil then
        if projectile.hostile and target.kind == 'player' then
            game:damage(1)
        elseif not projectile.hostile and target.kind == 'enemy' then
            target:hit(game, projectile.damage)
        elseif not projectile.hostile and target.kind == 'crate' then
            local direction = projectile.velocityX > 0 and 1 or -1
            game.world:hitCrate(target, direction, game)
        end
    end

    local explodes = projectile.weapon == 'fireball'
    game.effects:burst(hit.x, hit.y, explodes and 24 or 10, explodes)

    if not projectile.hostile then
        game.sound:play('impact')
    end
end

function Combat:step(deltaTime)
    for index = #self.slashes, 1, -1 do
        local slash = self.slashes[index]
        slash.life = slash.life - deltaTime
        slash.sprite:update(deltaTime)

        if slash.life <= 0 then
            table.remove(self.slashes, index)
        end
    end

    -- Sweep each projectile's whole movement segment to avoid tunnelling.
    for index = #self.projectiles, 1, -1 do
        local projectile = self.projectiles[index]
        local nextX = projectile.x + projectile.velocityX * deltaTime
        local nextY = projectile.y + projectile.velocityY * deltaTime
        local collisionMask = projectile.hostile and 11 or 7
        local hit = self.game.world.physics:raycast(
            projectile.firstCastX or projectile.x,
            projectile.y,
            nextX,
            nextY,
            {mask = collisionMask}
        )

        projectile.firstCastX = nil
        projectile.life = projectile.life - deltaTime

        if hit ~= nil then
            self:resolveHit(projectile, hit)
        end

        if hit ~= nil or projectile.life <= 0 then
            table.remove(self.projectiles, index)
        else
            projectile.x = nextX
            projectile.y = nextY
        end
    end
end

function Combat:draw()
    local atlas = Art.atlas('effects/effects')

    for _, projectile in ipairs(self.projectiles) do
        local frame = 'arrow'
        local width = 72
        local height = 22
        local pivotX = 0.79
        local pivotY = 0.5

        if projectile.weapon == 'fireball' then
            frame = 'fireball_1'
            width = 80
            height = 64
            -- The painted fireball's bright core sits ahead of the flame trail.
            pivotX = 103 / 128
            pivotY = 58 / 96
        end

        graphics.draw(atlas.texture, projectile.x, projectile.y, {
            source = atlas:source(frame),
            width = width,
            height = height,
            pivotX = pivotX,
            pivotY = pivotY,
            rotation = math.atan(projectile.velocityY, projectile.velocityX),
            color = projectile.hostile and '#FFFF8FB3' or '#FFFFFFFF',
        })
    end

    for _, slash in ipairs(self.slashes) do
        slash.sprite:draw(slash.x, slash.y, slash.facing)
    end
end

return Combat
