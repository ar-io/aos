local Hex = require(".crypto.util.hex");

-- External Results
local randRsl = {};
local randCnt = 0;

-- Internal State
local mm = {};
local aa,bb,cc = 0,0,0;

-- Cap to maintain 32 bit maths
local cap = 0x100000000;

-- CipherMode
local ENCRYPT = 1;
local DECRYPT = 2;

local function isaac()
  cc = ( cc + 1  ) % cap; -- cc just gets incremented once per 256 results
  bb = ( bb + cc ) % cap; -- then combined with bb

  for i = 0,255 do
    local   x    = mm[i];
    local   y;
    local   imod = i % 4;
    if      imod == 0 then aa = aa ~ (aa << 13);
    elseif  imod == 1 then aa = aa ~ (aa >> 6);
    elseif  imod == 2 then aa = aa ~ (aa << 2);
    elseif  imod == 3 then aa = aa ~ (aa >> 16);
    end
    aa         = ( mm[(i+128)%256] + aa ) % cap;
    y          = ( mm[(x>>2) % 256] + aa + bb ) % cap;
    mm[i]      = y;
    bb         = ( mm[(y>>10)%256] + x ) % cap;
    randRsl[i] = bb;
  end

  randCnt = 0; -- Prepare to use the first set of results.

end

local function mix(a)
  a[0] = ( a[0] ~ ( a[1] << 11 ) ) % cap;  a[3] = ( a[3] + a[0] ) % cap;  a[1] = ( a[1] + a[2] ) % cap;
  a[1] = ( a[1] ~ ( a[2] >>  2 ) ) % cap;  a[4] = ( a[4] + a[1] ) % cap;  a[2] = ( a[2] + a[3] ) % cap;
  a[2] = ( a[2] ~ ( a[3] <<  8 ) ) % cap;  a[5] = ( a[5] + a[2] ) % cap;  a[3] = ( a[3] + a[4] ) % cap;
  a[3] = ( a[3] ~ ( a[4] >> 16 ) ) % cap;  a[6] = ( a[6] + a[3] ) % cap;  a[4] = ( a[4] + a[5] ) % cap;
  a[4] = ( a[4] ~ ( a[5] << 10 ) ) % cap;  a[7] = ( a[7] + a[4] ) % cap;  a[5] = ( a[5] + a[6] ) % cap;
  a[5] = ( a[5] ~ ( a[6] >>  4 ) ) % cap;  a[0] = ( a[0] + a[5] ) % cap;  a[6] = ( a[6] + a[7] ) % cap;
  a[6] = ( a[6] ~ ( a[7] <<  8 ) ) % cap;  a[1] = ( a[1] + a[6] ) % cap;  a[7] = ( a[7] + a[0] ) % cap;
  a[7] = ( a[7] ~ ( a[0] >>  9 ) ) % cap;  a[2] = ( a[2] + a[7] ) % cap;  a[0] = ( a[0] + a[1] ) % cap;
end

local function randInit(flag)

  -- The golden ratio in 32 bit
  -- math.floor((((math.sqrt(5)+1)/2)%1)*2^32) == 2654435769 == 0x9e3779b9
  local a = { [0] = 0x9e3779b9, 0x9e3779b9, 0x9e3779b9, 0x9e3779b9, 0x9e3779b9, 0x9e3779b9, 0x9e3779b9, 0x9e3779b9, };

  aa,bb,cc = 0,0,0;

  for i = 1,4 do  mix(a)  end -- Scramble it.

  for i = 0,255,8 do -- Fill in mm[] with messy stuff.
    if flag then -- Use all the information in the seed.
      for j = 0,7 do
        a[j] = ( a[j] + randRsl[i+j] ) % cap;
      end
    end
    mix(a);
    for j = 0,7 do
      mm[i+j] = a[j];
    end
  end

  if flag then
    -- Do a second pass to make all of the seed affect all of mm.
    for i = 0,255,8 do
      for j = 0,7 do
        a[j] = ( a[j] + mm[i+j] ) % cap;
      end
      mix(a);
      for j = 0,7 do
        mm[i+j] = a[j];
      end
    end
  end

  isaac(); -- Fill in the first set of results.
  randCnt = 0; -- Prepare to use the first set of results.

end

-- Seed ISAAC with a given string.
-- The string can be any size. The first 256 values will be used.
local function seedIsaac(seed, flag)
  local seedLength = #seed;
  for i = 0,255 do mm[i] = 0; end
  for i = 0,255 do randRsl[i] = seed:byte(i+1,i+1) or 0; end
  randInit(flag);
end

-- Retrieves a random number from the ISAAC random number generator.
-- @return The random number.
local function getRandom()
    local result = randRsl[randCnt];
    randCnt = randCnt + 1;
    if randCnt > 255 then
        isaac();
        randCnt = 0;
    end
    return result;
end

-- Get a random 32-bit value within the specified range.
-- @param min (optional) The minimum value of the range. Defaults to 0.
-- @param max (optional) The maximum value of the range. Defaults to 2^31-1.
-- @return The random 32-bit value within the specified range.
local function random(min, max)
    local min = min or 0;
    local max = max or 2^31-1;
    local randomStr = tostring(math.random(2^31-1));
    seedIsaac(randomStr, true);
    return (getRandom() % (max - min + 1)) + min;
end

-- Get a random character in printable ASCII range
-- Returns a random character between ASCII values 32 and 126.
-- @return number: The random character.
local function getRandomChar()
    return getRandom() % 95 + 32;
end

-- Caesar-shift a character <shift> places: Generalized Vigenere
local function caesar(m, ch, shift, modulo, start)
  local n
  local si = 1
  if m == DECRYPT then shift = shift*-1 ; end
  n = (ch - start) + shift;
  if n < 0 then si,n = -1,n*-1 ; end
  n = ( n % modulo ) * si;
  if n < 0 then n = n + modulo ; end
  return start + n;
end

-- Encrypts a message using the ISSAC cipher algorithm.
-- @param msg (string) The message to be encrypted.
-- @param key (string) The encryption key. The string can be any size. The first 256 values will be used.
-- @return (string) The encrypted message.
local function encrypt(msg, key)
    seedIsaac(key, true);
    local msgLength = #msg;
    local destination = {};
    
    for i = 1, msgLength do 
        destination[i] = string.char(caesar(1, msg:byte(i, i), getRandomChar(), 95, 32));
    end
    
    return table.concat(destination);
end

-- Decrypts an encrypted message using the ISSAC cipher algorithm.
-- @param encrypted The encrypted message to be decrypted.
-- @param key The key used for encryption.
-- @return The decrypted message.
local function decrypt(encrypted, key)
    seedIsaac(key, true);
    local msgLength = #encrypted;
    local destination = {};
    
    for i = 1, msgLength do 
        destination[i] = string.char(caesar(2, encrypted:byte(i, i), getRandomChar(), 95, 32));
    end
    
    return table.concat(destination);
end

return {
    seedIsaac = seedIsaac,
    getRandomChar = getRandomChar,
    random = random,
    getRandom = getRandom,
    encrypt = encrypt,
    decrypt = decrypt
}