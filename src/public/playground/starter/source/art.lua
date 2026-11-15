-- Load shared artwork once so every actor uses the same cached textures.
local assets = require('haylen.assets')
local graphics = require('haylen.graphics2d')

local Art = {}
local textures = {}
local atlases = {}
local platforms = {}

-- Each rectangle selects one object from the unchanged imagegen terrain sheet.
-- The coordinates after the cell number are fractions of that cell.
local regions = {
    crystal = {9, {0.12, 0.11, 0.78, 0.69}},
    ruin = {10, {0.08, 0.02, 0.79, 0.78}},
    rock = {11, {0.02, 0.33, 0.88, 0.45}},
    relic = {12, {0.13, 0.06, 0.72, 0.73}},
    plant = {13, {0.08, 0.16, 0.85, 0.66}},
    flowers = {14, {0.12, 0.41, 0.68, 0.42}},
    portal = {15, {0.00, 0.01, 0.91, 0.82}},
}

function Art.texture(name)
    if textures[name] == nil then
        textures[name] = assets.texture('art/' .. name .. '.png', {filter = 'linear'})
    end

    return textures[name]
end

function Art.atlas(path)
    if atlases[path] == nil then
        atlases[path] = assets.load(path .. '.json', 'atlas', {filter = 'linear'})
    end

    return atlases[path]
end

-- Continuous textures use native nine-slice borders, so end caps appear only once.
function Art.platform(name)
    if platforms[name] == nil then
        local source = {16, 276, 2140, 199}
        local borderWidth = 90
        local fill = 'stretch'

        if name == 'bridge' then
            source = {42, 263, 2088, 225}
            borderWidth = 130
            fill = 'tile'
        end

        platforms[name] = {
            sourceHeight = source[4],
            slice = graphics.newNineSlice(Art.texture(name), {
                source = source,
                borders = {borderWidth, 0, borderWidth, 0},
                fill = fill,
            }),
        }
    end

    return platforms[name]
end

function Art.portrait(hero)
    return assets.texture('portraits/' .. hero .. '.png', {filter = 'linear'})
end

function Art.region(name)
    -- A tight crate frame puts the visible base on its physical bottom edge.
    if name == 'crate' then
        return {976, 370, 244, 223}
    end

    local definition = assert(regions[name], 'Unknown terrain sprite: ' .. name)
    local texture = Art.texture('environment-atlas')
    local cellNumber = definition[1] - 1
    local cellWidth = texture.width / 4
    local cellHeight = texture.height / 4
    local column = cellNumber % 4
    local row = math.floor(cellNumber / 4)
    local crop = definition[2]

    return {
        (column + crop[1]) * cellWidth,
        (row + crop[2]) * cellHeight,
        crop[3] * cellWidth,
        crop[4] * cellHeight,
    }
end

function Art.draw(name, x, y, options)
    local region = Art.region(name)
    local drawing = {source = region}

    for key, value in pairs(options or {}) do
        drawing[key] = value
    end

    if drawing.width ~= nil and drawing.height == nil then
        drawing.height = drawing.width * region[4] / region[3]
    end

    graphics.draw(Art.texture('environment-atlas'), x, y, drawing)
end

return Art
