-- The signed-in identity is shared by screens. Social records belong to the API.
local Session = {user = nil, saved = {}}

function Session.open(result)
    Session.user = result.user
    Session.saved = result.saved
end

function Session.close()
    Session.user = nil
    Session.saved = {}
end

return Session
