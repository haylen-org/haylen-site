-- The parts of the forms of the sign-in flow: a labeled field bound to the draft of its screen, the checks that mark fields with their errors, the busy state of a request and the layout of a form.
-- Each screen keeps its draft in `self.fields`, apart from its GUI, so the text survives while another screen covers it.
local ui = require('haylen.ui')

local Shell = require('shell')
local Style = require('style')

local Forms = {}

-- A labeled field. The last field of a form submits it with the return key, and the others move to the next field.
function Forms.field(page, id, label, kind, last)
    local options = {
        id = id,
        value = page.fields[id] or '',
        returnKey = last and 'go' or 'next',
        autocapitalize = id == 'name' and 'words' or 'none',
        onChange = function(event)
            page.fields[id] = event.value
        end,
        onSubmit = function()
            if last then
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

-- Marks every field whose rule fails with its message, and returns whether all of them passed.
function Forms.check(page, rules)
    local valid = true
    for _, rule in ipairs(rules) do
        local failed = not rule.valid
        page.gui:set(rule.id .. 'Field', {error = failed and rule.message or ''})
        valid = valid and not failed
    end
    return valid
end

function Forms.email(value)
    local address = value:match('^%s*(.-)%s*$')
    return address:match('^[^%s@]+@[^%s@]+%.[^%s@]+$') ~= nil
end

-- Shows that a request is on its way: the button waits with its new text and the spinner turns, and the error of the last request goes away.
function Forms.busy(page, busy, text)
    page.submitting = busy
    page.gui:set('submit', {enabled = not busy, text = text})
    page.gui:set('formBusy', {visible = busy})
    if busy then
        page.gui:set('formError', {visible = false, text = ''})
    end
end

function Forms.error(page, message)
    page.gui:set('formError', {text = message, visible = true})
end

-- The layout of a form: a back button on the screens pushed over the sign in, the wordmark, the title, the description, the contents and the place of the spinner and of the error, centered in the width it gets.
function Forms.layout(title, description, contents, back)
    local space = Style.space
    local fields = {
        gap = space.l,
        padding = {space.xl, space.l},
        Shell.wordmark(42),
        ui.label{text = title, font = 'title', style = Style.text('title', Style.type.display)},
        ui.label{text = description, color = 'textMuted'},
    }
    for _, child in ipairs(contents) do
        fields[#fields + 1] = child
    end
    fields[#fields + 1] = ui.busyIndicator{id = 'formBusy', visible = false, size = 24}
    fields[#fields + 1] = ui.label{id = 'formError', text = '', color = 'dangerText', visible = false}

    local top = ui.row{height = Style.size.header, padding = {0, space.s}, visible = back == true,
        ui.button{icon = Shell.icon('back'), iconColor = 'text', variant = 'icon', accessibilityLabel = 'Back', tooltip = 'Back', onClick = ui.goBack},
    }
    return ui.column{grow = 1, gap = 0, align = 'stretch',
        top,
        ui.scroll{grow = 1, fill = true, align = 'stretch',
            ui.column{gap = 0, ui.spacer{grow = 1}, Shell.centered(560, ui.column(fields)), ui.spacer{grow = 1}},
        },
    }
end

return Forms
