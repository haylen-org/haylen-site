-- The app owns its menus once. Screens change inside that shared frame.
-- Phones use the bottom bar, while wide windows use the navigation rail.
local events = require('haylen.events')
local scene = require('haylen.scene')
local ui = require('haylen.ui')
local viewport = require('haylen.viewport')
local window = require('haylen.window')

local Style = require('style')

local Shell = {}
Shell.chrome = {colors = {panel = '#FFFFFFFF'}, metrics = {panelRadius = 0, panelPadding = 0, borderWidth = 0}}

Shell.tabs = {
    {id = 'home', text = 'Home', icon = 'home', screen = 'screens.home'},
    {id = 'explore', text = 'Explore', icon = 'explore', screen = 'screens.explore'},
    {id = 'create', text = 'New post', image = 'images/create.svg', screen = 'screens.compose-pick', push = true},
    {id = 'messages', text = 'Messages', icon = 'messages', screen = 'screens.inbox'},
    {id = 'profile', text = 'Profile', screen = 'screens.profile'},
}
Shell.pushTransition = {duration = 0.28, effect = 'slideIn', direction = 'left', ease = 'cubicOut'}
Shell.backTransition = {duration = 0.24, effect = 'slideIn', direction = 'right', ease = 'cubicOut'}
Shell.riseTransition = {duration = 0.3, effect = 'moveIn', direction = 'up', ease = 'cubicOut'}
Shell.current = 'home'

local function reserveNavigation()
    if Shell.navigating or scene.transitioning() then
        return false
    end
    Shell.navigating = true
    return true
end

-- Stack changes start on the next update. Reserve them before another tap arrives.
local function navigationOptions(transition, complete)
    local options = {}
    for key, value in pairs(transition or {}) do
        options[key] = value
    end
    local previousComplete = options.onComplete
    options.onComplete = function(done)
        Shell.navigating = false
        if complete then
            complete(done)
        end
        if previousComplete then
            previousComplete(done)
        end
        window.setBackLeavesApp(scene.size() <= 1 and not Shell.composerLevel
            and (Shell.current == 'home' or Shell.current == 'login'))
    end
    return options
end

local function makePage(Screen, params, rootTab)
    local page = Screen(params)
    page.rootTab = rootTab
    page.navigationScreen = Screen
    page.navigationKey = Screen.routeKey and Screen.routeKey(params or {}) or nil
    return page
end

function Shell.icon(name)
    return 'icons/' .. name .. '.svg'
end

-- Returns the width of the safe area in UI units.
function Shell.width()
    local _, unit = ui.scale()
    return viewport.safeRect().width / unit
end

-- Mounts the notices, which stay above every screen, and shows the first tab.
function Shell.start()
    Shell.notices = ui.mount(ui.toast{id = 'notice', position = 'top', duration = 2.5, indicator = 'icon'}, {layer = 10, sharedFocus = true})
    Shell.mountChrome()
    Shell.showLogin()
end

function Shell.notify(text, tone)
    Shell.notices:command('notice', 'show', {text = text, tone = tone or 'neutral'})
end

-- Shows a tab as the only screen, without a transition, the way native tab bars switch, or pushes the screen of a tab that opens over the others, such as a new post.
function Shell.showTab(id, params)
    if Shell.composerLevel then
        return false
    end
    for _, tab in ipairs(Shell.tabs) do
        if tab.id == id then
            if tab.push then
                if not reserveNavigation() then
                    return false
                end
                Shell.composerLevel = scene.size()
                window.setBackLeavesApp(false)
                return scene.push(makePage(require(tab.screen), params), navigationOptions(Shell.riseTransition, function(done)
                    if not done then
                        Shell.composerLevel = nil
                    end
                end))
            end
            if not reserveNavigation() then
                return false
            end
            Shell.current = id
            if scene.size() > 1 then
                scene.popToRoot()
            end
            local change = scene.replace(makePage(require(tab.screen), params, id), navigationOptions({duration = 0}))
            window.setBackLeavesApp(id == 'home')
            return change
        end
    end
end

-- Pushes a screen over the current one with a slide, or with another transition.
function Shell.open(Screen, params, transition)
    if Shell.composerLevel and not Screen.composerScreen then
        return false
    end
    local key = Screen.routeKey and Screen.routeKey(params or {}) or nil
    -- Revisit an existing post, person or conversation instead of stacking a cycle.
    for level = scene.size(), 1, -1 do
        local page = scene.at(level)
        if page.navigationScreen == Screen and page.navigationKey == key then
            if level == scene.size() or not reserveNavigation() then
                return false
            end
            return scene.popTo(level, navigationOptions(Shell.backTransition))
        end
    end
    if not reserveNavigation() then
        return false
    end
    window.setBackLeavesApp(false)
    return scene.push(makePage(Screen, params), navigationOptions(transition or Shell.pushTransition))
end

-- Puts a screen in the place of the current one with the same slide, such as the next step of a new post.
function Shell.replace(Screen, params)
    if Shell.composerLevel and not Screen.composerScreen then
        return false
    end
    if not reserveNavigation() then
        return false
    end
    return scene.replace(makePage(Screen, params), navigationOptions(Shell.pushTransition))
end

-- Cancel every composer step, returning to the exact screen that opened it.
function Shell.closeCompose()
    local origin = Shell.composerLevel
    if not origin or not reserveNavigation() then
        return false
    end
    require('compose').endFlow()
    return scene.popTo(origin, navigationOptions(Shell.backTransition, function(done)
        if done then
            Shell.composerLevel = nil
        end
    end))
end

-- Publishing leaves no composer scenes behind the destination feed.
function Shell.finishCompose()
    if not Shell.composerLevel or Shell.navigating or scene.transitioning() then
        return false
    end
    require('compose').endFlow()
    Shell.composerLevel = nil
    return Shell.showTab('home')
end

-- Goes back one screen, or to the home tab from the root of another tab.
function Shell.back()
    if Shell.composerLevel and scene.size() <= Shell.composerLevel + 1 then
        return Shell.closeCompose()
    end
    if scene.size() > 1 then
        if not reserveNavigation() then
            return false
        end
        return scene.pop(navigationOptions(scene.top().backTransition or Shell.backTransition))
    elseif Shell.current ~= 'home' and Shell.current ~= 'login' then
        Shell.showTab('home')
    end
end

-- Only the central view adapts. Shared navigation keeps its GUI and control state.
function Shell.adapt(page)
    local left, bottom, _, chromeWide = Shell.insets(page)
    local contentWidth = Shell.width() - left
    local wide = page.rootTab and chromeWide or contentWidth >= Style.wideWidth
    local roomy = contentWidth >= Style.roomyWidth - Style.size.rail
    Shell.syncChrome(page)
    if page.wide == wide and page.roomy == roomy and page.chromeWide == chromeWide then
        return
    end
    page.wide, page.roomy, page.chromeWide = wide, roomy, chromeWide
    page.gui:set('shell-left-inset', {width = left})
    page.gui:set('shell-bottom-inset', {height = bottom})
    if page.gui:has('authArt') then
        page.gui:set('authArt', {visible = wide})
    end
    if page.layoutChanged then
        page:layoutChanged(wide, roomy)
    end
end

-- The picture of a tab: its icon, filled while it shows, the round button of a new post in the colors of the app, or the face of the person for the profile.
function Shell.tabIcon(tab, selected)
    if tab.id == 'profile' then
        local me = require('data.social').me
        return selected and me.avatarRing or me.avatar
    end
    if tab.image then
        return tab.image
    end

    return Shell.icon(tab.icon .. (selected and '-filled' or ''))
end

function Shell.tabButton(tab, current, placement)
    local selected = tab.id == current
    local rail = placement == 'rail'
    -- The face of the profile and the button of a new post keep their colors, and the icons take the color of the text. The button of a new post stands out in the bar.
    local iconColor = 'text'
    local iconSize = 32
    if tab.id == 'profile' then
        iconColor = false
    elseif tab.image then
        iconColor = false
        iconSize = rail and 32 or 48
    end
    local button = ui.button{
        id = placement .. '-' .. tab.id,
        text = rail and tab.text or nil,
        icon = Shell.tabIcon(tab, selected),
        iconColor = iconColor,
        variant = 'toolbar',
        justify = rail and 'start' or 'center',
        grow = rail and 0 or 1,
        align = rail and 'stretch' or 'center',
        height = rail and 64 or Style.size.tabBar - Style.space.s,
        accessibilityLabel = tab.text,
        tooltip = not rail and tab.text or nil,
        style = {fonts = {button = {size = Style.type.body, bold = selected}}, metrics = {iconSize = iconSize, controlPaddingX = Style.space.m, contentSpacing = Style.space.m}},
        onClick = function()
            if Shell.current ~= tab.id or scene.size() > 1 or tab.push then
                Shell.showTab(tab.id)
            end
        end,
    }
    if tab.id ~= 'messages' then
        return button
    end
    -- The messages tab carries the count of unread messages, at the end of its row in the rail and over its icon in the bar.
    if rail then
        return ui.stack{align = 'stretch',
            button,
            ui.row{gap = 0, align = 'stretch', justify = 'end', padding = {0, Style.space.m, 0, 0}, ui.badge{id = 'rail-unread', text = '', tone = 'danger', solid = true, visible = false}},
        }
    end
    return ui.stack{align = 'center', grow = 1,
        button,
        ui.row{gap = 0, align = 'center', padding = {0, 0, 22, 44}, ui.badge{id = 'bar-unread', text = '', tone = 'danger', solid = true, visible = false}},
    }
end

-- The app owns its navigation GUI once. Screens only own the central view.
function Shell.updateUnread()
    local count = require('chats').unreadCount()
    for _, placement in ipairs({'rail', 'bar'}) do
        Shell.chromeGui:set(placement .. '-unread', {text = count, visible = count > 0})
    end
end

function Shell.wordmark(size)
    return ui.row{gap = Style.space.s,
        ui.image{image = 'images/logo.svg', width = size, height = size, accessibilityHidden = true},
        ui.label{text = 'Photo Social', font = 'title', wrap = false, style = Style.text('title', Style.type.heading)},
    }
end

function Shell.mountChrome()
    local space = Style.space
    local rail = {grow = 1, gap = space.xs, padding = {space.xl, space.m, space.l, space.m}, align = 'stretch',
        ui.row{padding = {0, space.s, space.xl, space.s}, Shell.wordmark(52)},
    }
    local bar = {gap = 0, height = Style.size.tabBar, padding = {0, space.s}}
    for _, tab in ipairs(Shell.tabs) do
        rail[#rail + 1] = Shell.tabButton(tab, Shell.current, 'rail')
        bar[#bar + 1] = Shell.tabButton(tab, Shell.current, 'bar')
    end
    rail[#rail + 1] = ui.spacer{grow = 1}
    rail[#rail + 1] = ui.button{text = 'Sign out', variant = 'link', align = 'start', onClick = Shell.signOut}
    Shell.chromeGui = ui.mount(ui.row{gap = 0, onCancel = Shell.back,
        ui.panel{id = 'rail', width = Style.size.rail, visible = false, padding = 0, align = 'stretch', style = Shell.chrome, ui.column(rail)},
        ui.column{grow = 1, gap = 0, align = 'stretch',
            ui.spacer{grow = 1},
            ui.panel{id = 'tabBar', height = Style.size.tabBar, visible = false, padding = 0, gap = 0, style = Shell.chrome, ui.row(bar)},
        },
    }, {owner = Shell, layer = 5, sharedFocus = true})
    Shell.chromeGui.visible = false
    events.on('chatChanged', Shell.updateUnread, {owner = Shell})
    Shell.updateUnread()
end

function Shell.insets(page)
    local shown = not page.authScreen and not page.composerScreen and not page.fullscreen
    local wide = Shell.width() >= Style.wideWidth
    return shown and wide and Style.size.rail or 0,
        shown and not wide and Style.size.tabBar or 0, shown, wide
end

function Shell.syncChrome(page)
    local _, _, shown, wide = Shell.insets(page)
    local state = Shell.chromeState
    if state and state.shown == shown and state.wide == wide and state.current == Shell.current then
        return
    end
    Shell.chromeState = {shown = shown, wide = wide, current = Shell.current}
    Shell.chromeGui.visible = shown
    Shell.chromeGui:set('rail', {visible = wide})
    Shell.chromeGui:set('tabBar', {visible = not wide})
    for _, tab in ipairs(Shell.tabs) do
        local selected = Shell.current == tab.id
        for _, placement in ipairs({'rail', 'bar'}) do
            local iconSize = tab.image and (placement == 'rail' and 32 or 48) or 32
            Shell.chromeGui:set(placement .. '-' .. tab.id, {
                icon = Shell.tabIcon(tab, selected),
                style = {fonts = {button = {size = Style.type.body, bold = selected}},
                    metrics = {iconSize = iconSize, controlPaddingX = Style.space.m, contentSpacing = Style.space.m}},
            })
        end
    end
end

-- Centers a node in the width it gets, as wide as it may be up to `maxWidth`. A `grow` lets the row take the free height of a column.
function Shell.centered(maxWidth, node, grow)
    node.grow = 100
    node.maxWidth = maxWidth
    node.align = 'stretch'
    return ui.row{gap = 0, grow = grow or 0, align = 'stretch', ui.spacer{grow = 1}, node, ui.spacer{grow = 1}}
end

-- A bar at the top of a pushed screen: a back button, a title and optional trailing nodes.
function Shell.header(title, trailing, options)
    options = options or {}
    local row = {gap = Style.space.xs, padding = {0, Style.space.s}, height = Style.size.header}
    row[#row + 1] = ui.button{id = 'back', icon = Shell.icon(options.close and 'close' or 'back'), iconColor = 'text', variant = 'icon', accessibilityLabel = options.close and 'Close' or 'Back', tooltip = options.close and 'Close' or 'Back', onClick = options.onBack or Shell.back}
    row[#row + 1] = ui.label{id = 'title', text = title, font = 'heading', wrap = false, grow = 1}
    for _, node in ipairs(trailing or {}) do
        row[#row + 1] = node
    end
    return ui.column{gap = 0, ui.row(row), ui.divider{}}
end

-- Authentication uses the same scene stack as the rest of the app.
function Shell.showLogin()
    if not reserveNavigation() then
        return false
    end
    Shell.current = 'login'
    if scene.size() > 1 then
        scene.popToRoot()
    end
    local change = scene.replace(makePage(require('screens.login'), nil, 'login'), navigationOptions({duration = 0}))
    window.setBackLeavesApp(true)
    return change
end

function Shell.signOut()
    if not Shell.showLogin() then
        return false
    end
    require('services.fake-api').signOut()
    require('session').close()
    return true
end
return Shell
