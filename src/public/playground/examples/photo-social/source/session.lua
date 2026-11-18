-- The person who signed in. The session puts their name, handle and bio on the profile of the app, and hands back the changes of the profile when they sign out, so the next sign in shows them.
local events = require('haylen.events')

local Social = require('data.social')

local Session = {user = nil}

function Session.open(user)
    Session.user = user
    local me = Social.me
    me.name = user.name
    me.handle = user.handle
    me.bio = user.bio
    -- The posts of the person show their handle, so they describe themselves again.
    for _, post in ipairs(me.posts or {}) do
        Social.describe(post)
    end
    events.emit('socialChanged', me)
end

function Session.close()
    local user = Session.user
    if user then
        local me = Social.me
        user.name = me.name
        user.bio = me.bio
    end
    Session.user = nil
end

return Session
