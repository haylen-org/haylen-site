-- The post being made: the picture, its crop and its filter, and the images of its steps. The previews are made on the task pool from the decoded picture and named for the UI with ui.setImage, so changing the filter never holds up a frame.
local async = require('async')
local graphics = require('haylen.graphics')
local ui = require('haylen.ui')

local Photos = require('photos')

local Compose = {}

Compose.preview = '@compose-preview'
-- Pixels on each side of the middle of the picture that the small previews of the filters show.
Compose.thumbSize = 384
Compose.made = 0
Compose.generation = 0

function Compose.begin()
    Compose.generation = Compose.generation + 1
    Compose.photo, Compose.crop, Compose.filter = Photos.list[1].id, 'full', 'normal'
    Compose.caption, Compose.place = '', ''
    Compose.image, Compose.texture = nil, nil
end

-- Work from a closed flow must not update the next flow's pictures or filters.
function Compose.endFlow()
    Compose.generation = Compose.generation + 1
end

function Compose.thumbName(filter)
    return '@compose-filter-' .. filter
end

-- The look of the chosen picture with its crop, which shows until the preview with the filter is ready.
function Compose.look()
    return Photos.look(Compose.photo, Compose.crop)
end

-- Decodes the chosen picture and makes the small previews of every filter, which show the color of the picture until they are ready, then the preview of the post.
function Compose.prepare()
    local photo = Compose.photo
    local generation = Compose.generation
    Compose.image, Compose.texture = nil, nil
    local stand = Photos.texture(graphics.newImage(2, 2, Photos.byId[photo].tone))
    for _, filter in ipairs(Photos.filters) do
        ui.setImage(Compose.thumbName(filter.id), stand)
    end
    return async.promise(function()
        local image = Photos.decode(photo):await()
        if Compose.generation ~= generation or Compose.photo ~= photo then
            return false
        end
        Compose.image = image
        local x = (image.width - Compose.thumbSize) // 2
        local y = (image.height - Compose.thumbSize) // 2
        local middle = image:crop({x, y, Compose.thumbSize, Compose.thumbSize})
        for _, filter in ipairs(Photos.filters) do
            local thumb = middle:applyAsync(filter.effects):await()
            if Compose.generation ~= generation or Compose.photo ~= photo then
                return false
            end
            ui.setImage(Compose.thumbName(filter.id), Photos.texture(thumb))
        end
        return Compose.render():await()
    end)
end

-- Makes the preview of the post with the chosen crop and filter, and resolves with whether it is the one the post shows now.
function Compose.render()
    local photo, crop, filter = Compose.photo, Compose.crop, Compose.filter
    local generation = Compose.generation
    return async.promise(function()
        local image = Compose.image
        if not image then
            return false
        end
        local side = math.min(image.width, image.height)
        local fullArea = {(image.width - side) // 2, (image.height - side) // 2, side, side}
        local area = crop == 'close' and Photos.closeArea(Photos.byId[photo], image) or fullArea
        local made = image:crop(area):applyAsync(Photos.filterById[filter].effects):await()
        if Compose.generation ~= generation or Compose.photo ~= photo or Compose.crop ~= crop or Compose.filter ~= filter then
            return false
        end
        Compose.texture = Photos.texture(made)
        ui.setImage(Compose.preview, Compose.texture)
        return true
    end)
end

-- Names the finished picture for the post and returns the name, or the look of the picture while its preview is still being made.
function Compose.finish()
    if not Compose.texture then
        return Compose.look()
    end
    Compose.made = Compose.made + 1
    local name = '@post-made-' .. Compose.made
    ui.setImage(name, Compose.texture)
    return name
end

return Compose
