-- Try changing these values while the game is running.
-- Hot reload keeps the player in the level when this module changes.
local input = require('haylen.input')
local Player = {}
Player.__index = Player

Player.speed = 270
Player.jumpSpeed = 620
Player.gravity = 1550

function Player.new(x, y)
    return setmetatable({x = x, y = y, width = 30, height = 40,
        vy = 0, grounded = false, facingLeft = false}, Player)
end

function Player:update(dt, platforms)
    local move = input.value('move')
    self.x = math.max(0, self.x + move * Player.speed * dt)
    if move ~= 0 then self.facingLeft = move < 0 end
    if input.pressed('jump') and self.grounded then
        self.vy = -Player.jumpSpeed
        self.grounded = false
    end
    local previousBottom = self.y + self.height
    self.vy = self.vy + Player.gravity * dt
    self.y = self.y + self.vy * dt
    self.grounded = false
    for _, platform in ipairs(platforms) do
        if self.x + self.width > platform.x and self.x < platform.x + platform.width
            and self.vy >= 0 and previousBottom <= platform.y + 2
            and self.y + self.height >= platform.y then
            self.y = platform.y - self.height
            self.vy = 0
            self.grounded = true
        end
    end
end

return Player
