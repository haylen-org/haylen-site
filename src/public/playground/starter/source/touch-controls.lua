-- Touch input belongs to this project, not to the browser IDE.
local input = require('haylen.input')
local graphics = require('haylen.graphics2d')

local Controls = {}
Controls.__index = Controls

local buttons = {
    {action = 'jump', label = 'JUMP', x = 1130, y = 580, radius = 68},
    {action = 'dash', label = 'DASH', x = 950, y = 635, radius = 60},
    {action = 'hero', label = 'HERO', x = 1130, y = 415, radius = 58},
}

function Controls.new()
    return setmetatable({
        visible = false,
        pulses = {},
        aimPoint = nil,
        stickX = 160,
        stickY = 570,
    }, Controls)
end

function Controls:update(deltaTime)
    self.visible = input.lastDevice() == 'touch'
    self.aimPoint = nil
    self.moving = 0
    local held = {}

    for action, time in pairs(self.pulses) do
        self.pulses[action] = math.max(0, time - deltaTime)
        held[action] = self.pulses[action] > 0
    end

    for _, touch in ipairs(input.touches()) do
        local down = touch.phase ~= 'ended' and touch.phase ~= 'cancelled'
        local quickTap = touch.phase == 'ended' and touch.duration < 0.2

        -- A complete tap can begin and end between two rendered frames.
        if down or quickTap then
            local pressedButton = false

            for _, button in ipairs(buttons) do
                local differenceX = touch.x - button.x
                local differenceY = touch.y - button.y
                local inside = differenceX * differenceX + differenceY * differenceY < button.radius ^ 2

                if inside then
                    pressedButton = true
                    held[button.action] = true

                    if touch.phase == 'began' or quickTap then
                        self.pulses[button.action] = 0.14
                    end
                end
            end

            if not pressedButton and touch.startX < 440 then
                local drag = touch.x - touch.startX
                self.stickX = touch.startX
                self.stickY = touch.startY
                self.moving = math.max(-1, math.min(1, drag / 65))
            elseif not pressedButton then
                self.aimPoint = {x = touch.x, y = touch.y}
                held.fire = true
            end
        end
    end

    -- Virtual inputs join the same action map as the keyboard and controller.
    input.setVirtualButton('left', self.moving < -0.15)
    input.setVirtualButton('right', self.moving > 0.15)

    for _, action in ipairs({'jump', 'dash', 'hero', 'fire'}) do
        input.setVirtualButton(action, held[action] == true)
    end
end

function Controls:draw()
    if not self.visible then
        return
    end

    graphics.beginScreen()
    graphics.drawCircle(self.stickX, self.stickY, 85, '#70303C58')
    graphics.drawCircle(self.stickX + self.moving * 50, self.stickY, 34, '#A0C2D1F5')

    for _, button in ipairs(buttons) do
        graphics.drawCircle(button.x, button.y, button.radius, '#A01B2948')
        graphics.drawText(nil, button.label, button.x - 24, button.y - 10, {size = 19, color = '#FFF0F4FF'})
    end
end

return Controls
