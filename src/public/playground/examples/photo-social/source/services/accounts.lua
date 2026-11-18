-- The accounts service: signing in, creating an account and asking for a password reset over HTTPS, the way an app talks to its own backend.
-- httpbin.org, a public service for testing HTTP clients, stands in for that backend. Every call shows the same steps: send the request, check that an answer arrived, check its status code, read its JSON and check what it says before the app trusts it.
-- Each function waits on a promise, so it runs inside a task, such as one that a screen starts with `scene.spawn(screen, fn)`. It returns the result, or nil and a sentence that the screen shows.
local crypto = require('crypto')
local http = require('http')

local Accounts = {}

Accounts.base = 'https://httpbin.org'

-- One deadline for each whole request, from the connection to the last byte of the answer.
Accounts.timeoutSeconds = 15

-- The demo account, prefilled on the sign-in screen. httpbin keeps no accounts, so the accounts of this demo live in memory for the run, and the app names the expected password in the address of the request, which httpbin compares with the credentials the request carries. A real backend keeps its accounts on the server and never hands them to the app.
local accounts = {
    ['rosa@example.com'] = {
        password = 'explore123',
        user = {name = 'Rosa Almeida', handle = 'rosa.almeida', bio = 'Collecting small happy moments around town.'},
    },
}

Accounts.demoEmail = 'rosa@example.com'
Accounts.demoPassword = 'explore123'

-- Trims the address and compares it without case, as sign-in services do.
function Accounts.address(value)
    return value:lower():match('^%s*(.-)%s*$')
end

-- The sentence for a request that got no answer at all: no connection, a host that cannot be found, a deadline that passed or a request that the browser blocked.
local function unreachable(failure)
    return 'The accounts service could not be reached. Check your connection and try again. (' .. tostring(failure) .. ')'
end

-- The sentence for an answer whose status code the app does not expect, such as 500 when the service fails or 503 when it is busy.
local function unexpectedStatus(response)
    return 'The accounts service answered with status ' .. response.status .. '. Try again in a moment.'
end

-- Reads the JSON of an answer. A body that is not JSON, or that is not an object, is no answer the app can trust.
local function readJson(response)
    local contentType = response.headers['content-type'] or ''
    if not contentType:find('application/json', 1, true) then
        return nil
    end
    local parsed, body = pcall(response.json)
    if not parsed or type(body) ~= 'table' then
        return nil
    end
    return body
end

local unreadable = 'The accounts service sent an answer the app does not understand. Try again.'

-- Posts a JSON body. httpbin answers 200 with what it received under "json", which proves that the body crossed the network as sent.
local function postJson(path, body, controller)
    local response, failure = http.client.post(Accounts.base .. path, {
        json = body,
        headers = {Accept = 'application/json'},
        timeoutSeconds = Accounts.timeoutSeconds,
        controller = controller,
    }):await()
    if not response then
        return nil, unreachable(failure)
    end
    if response.status ~= 200 then
        return nil, unexpectedStatus(response)
    end
    local answer = readJson(response)
    if not answer or type(answer.json) ~= 'table' then
        return nil, unreadable
    end
    return answer.json
end

-- Signs in with HTTP Basic authentication: the header "Authorization: Basic <base64 of email:password>". httpbin answers 200 with {"authenticated": true, "user": ...} when the header matches the address, and 401 when it does not.
function Accounts.signIn(email, password, controller)
    local contact = Accounts.address(email)
    local account = accounts[contact]
    -- An address without an account still asks the service, against a password that nobody can type, so a wrong address and a wrong password get the same answer.
    local expected = account and account.password or crypto.uuidV4()
    local url = Accounts.base .. '/basic-auth/' .. http.urlEncode(contact) .. '/' .. http.urlEncode(expected)
    local response, failure = http.client.get(url, {
        headers = {
            Accept = 'application/json',
            Authorization = 'Basic ' .. crypto.base64Encode(contact .. ':' .. password),
        },
        timeoutSeconds = Accounts.timeoutSeconds,
        controller = controller,
    }):await()
    if not response then
        return nil, unreachable(failure)
    end

    -- 401 Unauthorized is an answer, not a failure of the request, so the promise resolves and the app checks the status.
    if response.status == 401 then
        return nil, 'That email and password do not match.'
    end
    if response.status ~= 200 then
        return nil, unexpectedStatus(response)
    end

    local answer = readJson(response)
    if not answer or answer.authenticated ~= true or answer.user ~= contact or not account then
        return nil, unreadable
    end
    return {user = account.user}
end

-- Creates an account. The request carries the name and the address, and httpbin echoes them back. The password stays on the device, since this demo has no server that would keep it.
function Accounts.signUp(fields, controller)
    local contact = Accounts.address(fields.email)
    -- A real backend would answer 409 Conflict for an address it already holds.
    if accounts[contact] then
        return nil, 'That email is already registered. Try signing in.'
    end

    local name = fields.name:match('^%s*(.-)%s*$')
    local echo, message = postJson('/post', {name = name, email = contact}, controller)
    if not echo then
        return nil, message
    end
    if echo.email ~= contact or echo.name ~= name then
        return nil, unreadable
    end

    local handle = name:lower():gsub('%s+', '.')
    local account = {password = fields.password, user = {name = name, handle = handle, bio = ''}}
    accounts[contact] = account
    return {user = account.user}
end

-- Asks for a password reset for an address. A real backend sends an email, and answers the same way for every address, so nobody learns which addresses have accounts.
function Accounts.resetPassword(email, controller)
    local contact = Accounts.address(email)
    local echo, message = postJson('/post', {email = contact}, controller)
    if not echo then
        return nil, message
    end
    if echo.email ~= contact then
        return nil, unreadable
    end
    return {message = 'If ' .. contact .. ' has an account, a reset link is on its way.'}
end

return Accounts
