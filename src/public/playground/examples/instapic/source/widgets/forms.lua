-- Shared form presentation keeps validation and submission inside each screen.
local ui = require('haylen.ui')
local Shell = require('shell')
local Style = require('style')

local Forms = {}

function Forms.field(page, id, label, kind)
    local submits = id == 'confirm'
        or (id == 'password' and page.fields.confirm == nil)
        or (id == 'email' and page.fields.password == nil)
    local options = {
        id = id,
        value = page.fields[id] or '',
        returnKey = submits and 'go' or 'next',
        autocapitalize = id == 'name' and 'words' or 'none',
        onChange = function(event)
            page.fields[id] = event.value
        end,
        onSubmit = function()
            if submits then
                page:submit()
            end
        end,
    }
    local control
    if kind == 'password' then
        control = ui.secretField(options)
    else
        options.keyboard = kind or 'text'
        control = ui.textField(options)
    end
    return ui.formField{id = id .. 'Field', label = label, control}
end

function Forms.check(page, rules)
    local valid = true
    for _, rule in ipairs(rules) do
        local message = rule.message
        local failed = not rule.valid
        page.gui:set(rule.id .. 'Field', {error = failed and message or ''})
        valid = valid and not failed
    end
    return valid
end

function Forms.email(value)
    local address = value:match('^%s*(.-)%s*$')
    return address:match('^[^%s@]+@[^%s@]+%.[^%s@]+$') ~= nil
end

function Forms.busy(page, busy, text)
    page.submitting = busy
    page.gui:set('submit', {enabled = not busy, text = text})
    page.gui:set('formBusy', {visible = busy})
    page.gui:set('formError', {visible = false, text = ''})
end

function Forms.error(page, message)
    page.gui:set('formError', {text = message, visible = true})
end

function Forms.layout(title, description, contents, onCancel)
    local fields = {
        gap = 20, maxWidth = 540, padding = {36, 24},
        Shell.wordmark(42),
        ui.spacer{height = 16},
        ui.label{text = title, font = 'title', style = Style.text('title', 56, true)},
        ui.label{text = description, color = 'textMuted', margin = {0, 0, 8, 0}},
    }
    for _, child in ipairs(contents) do
        fields[#fields + 1] = child
    end
    fields[#fields + 1] = ui.busyIndicator{id = 'formBusy', visible = false, size = 24}
    fields[#fields + 1] = ui.label{id = 'formError', text = '', color = 'dangerText', visible = false}

    return ui.row{gap = 0, align = 'stretch', onCancel = onCancel or Shell.back,
        ui.column{id = 'authArt', grow = 1, padding = 24, gap = 14, visible = false,
            ui.image{image = 'photos/coast.png', fit = 'cover', radius = 28, grow = 1, align = 'stretch'},
            ui.row{gap = 8, ui.icon{image = Shell.icon('home'), size = 22, color = 'textMuted'},
                ui.label{text = 'Everyday moments. A world of inspiration.', font = 'caption', color = 'textMuted'},
            },
        },
        ui.scroll{grow = 1, fill = true, align = 'stretch',
            ui.column{gap = 0, ui.spacer{grow = 1}, Shell.centered(600, ui.column(fields)), ui.spacer{grow = 1}},
        },
    }
end

return Forms
