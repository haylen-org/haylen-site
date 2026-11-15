-- Authentication has one asynchronous boundary, ready to replace with HTTP calls.
-- Accounts stay in memory. Social content belongs to the separate data.social module.
local events = require('haylen.events')
local timer = require('haylen.timer')
local Api = {}
local accounts = {
    ['alex@example.com'] = {
        password = 'explore123',
        user = {name = 'Alex Morgan', handle = 'alexmorgan', bio = 'Collecting small happy moments around town.'},
    },
}
local current

local function address(value)
    return value:lower():match('^%s*(.-)%s*$')
end

-- The screen owns the timer, so leaving the screen cancels an unfinished request.
local function request(owner, handler, complete)
    return timer.after(0.4, function()
        local result, message = handler()
        complete(result, message)
    end, {owner = owner, unscaled = true})
end

function Api.signIn(fields, owner, complete)
    local email = address(fields.email)
    local password = fields.password
    return request(owner, function()
        local account = accounts[email]
        if not account or account.password ~= password then
            return nil, 'That email and password do not match.'
        end
        current = account
        return {user = account.user, saved = {}}
    end, complete)
end

function Api.signUp(fields, owner, complete)
    local email = address(fields.email)
    local name = fields.name
    local password = fields.password
    return request(owner, function()
        if accounts[email] then
            return nil, 'That email is already registered. Try signing in.'
        end
        local handle = name:lower():gsub('%s+', '.')
        local account = {password = password, user = {name = name, handle = handle, bio = ''}}
        accounts[email] = account
        current = account
        return {user = account.user, saved = {}}
    end, complete)
end

function Api.resetPassword(email, owner, complete)
    local contact = address(email)
    return request(owner, function()
        return {message = 'Password reset requested for ' .. contact .. '.'}
    end, complete)
end

function Api.activate(user)
    local Social = require('data.social')
    Social.me.name = user.name
    Social.me.handle = user.handle
    Social.me.bio = user.bio
    for _, post in ipairs(Social.me.posts) do
        Social.describe(post)
    end
    events.emit('socialChanged', Social.me)
end

function Api.signOut()
    if current then
        local me = require('data.social').me
        current.user.name = me.name
        current.user.handle = me.handle
        current.user.bio = me.bio
    end
    current = nil
end

return Api
