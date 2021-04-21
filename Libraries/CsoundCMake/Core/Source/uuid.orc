#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: uuid.orc
//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE_GUARD_IFNDEF} CsoundCMake_uuid_orc
${CSOUND_INCLUDE_GUARD_DEFINE} CsoundCMake_uuid_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}

${CSOUND_INCLUDE} "log.orc"


// Python is used to generate new UUIDs.
pyinit


opcode hexCharFromByte, S, i
    iNumber xin
    SHexChar = ""

    if (iNumber == 0) then
        SHexChar = "0"
    elseif (iNumber == 1) then
        SHexChar = "1"
    elseif (iNumber == 2) then
        SHexChar = "2"
    elseif (iNumber == 3) then
        SHexChar = "3"
    elseif (iNumber == 4) then
        SHexChar = "4"
    elseif (iNumber == 5) then
        SHexChar = "5"
    elseif (iNumber == 6) then
        SHexChar = "6"
    elseif (iNumber == 7) then
        SHexChar = "7"
    elseif (iNumber == 8) then
        SHexChar = "8"
    elseif (iNumber == 9) then
        SHexChar = "9"
    elseif (iNumber == 10) then
        SHexChar = "a"
    elseif (iNumber == 11) then
        SHexChar = "b"
    elseif (iNumber == 12) then
        SHexChar = "c"
    elseif (iNumber == 13) then
        SHexChar = "d"
    elseif (iNumber == 14) then
        SHexChar = "e"
    elseif (iNumber == 15) then
        SHexChar = "f"
    else
        log_i_warning("Invalid hex byte %f", iNumber)
    endif

    xout SHexChar
endop


opcode hexStringFromByteArray, S, i[]
    iByteArray[] xin
    SHex = ""

    iI = 0
    iByteArrayLength = lenarray(iByteArray)
    while (iI < iByteArrayLength) do
        iByte = iByteArray[iI]
        iNumber2 = iByte % 16
        iNumber1 = (iByte - iNumber2) / 16
        SChar1 = hexCharFromByte(iNumber1)
        SChar2 = hexCharFromByte(iNumber2)
        SHex = strcat(SHex, SChar1)
        SHex = strcat(SHex, SChar2)
        iI += 1
    od

    xout SHex
endop


opcode uuidStringFromByteArray, S, i[]
    ib[] xin
    SUuid = ""

    iUuid1[] fillarray ib[0], ib[1], ib[2], ib[3]
    iUuid2[] fillarray ib[4], ib[5]
    iUuid3[] fillarray ib[6], ib[7]
    iUuid4[] fillarray ib[8], ib[9]
    iUuid5[] fillarray ib[10], ib[11], ib[12], ib[13], ib[14], ib[15]

    SUuid = strcat(SUuid, hexStringFromByteArray(iUuid1))
    SUuid = strcat(SUuid, "-")
    SUuid = strcat(SUuid, hexStringFromByteArray(iUuid2))
    SUuid = strcat(SUuid, "-")
    SUuid = strcat(SUuid, hexStringFromByteArray(iUuid3))
    SUuid = strcat(SUuid, "-")
    SUuid = strcat(SUuid, hexStringFromByteArray(iUuid4))
    SUuid = strcat(SUuid, "-")
    SUuid = strcat(SUuid, hexStringFromByteArray(iUuid5))

    xout SUuid
endop


opcode uuid, S, 0
    // Generate a new UUID and write its 16 bytes as separate lines in file 'uuid' so the `fini` opcode can read them.
    pylruni("import uuid")
    pylruni("id = uuid.uuid4()")
    pylruni("text_file = open('uuid', 'w')")
    pylruni("[text_file.write(str(ord(b)) + '\\n') for b in id.bytes]")
    pylruni("text_file.close()")

    // Uncomment the following lines to write the uuid in string form to 'uuid.txt'.
    ; pylruni("text_file = open('uuid.txt', 'w')")
    ; pylruni("text_file.write(str(id))")
    ; pylruni("text_file.close()")

    iUuid01 init 0
    iUuid02 init 0
    iUuid03 init 0
    iUuid04 init 0
    iUuid05 init 0
    iUuid06 init 0
    iUuid07 init 0
    iUuid08 init 0
    iUuid09 init 0
    iUuid10 init 0
    iUuid11 init 0
    iUuid12 init 0
    iUuid13 init 0
    iUuid14 init 0
    iUuid15 init 0
    iUuid16 init 0

    iUuidHandle = fiopen("uuid", 1)
    fini(iUuidHandle, 0, 1, iUuid01, iUuid02, iUuid03, iUuid04, iUuid05, iUuid06, iUuid07, iUuid08, iUuid09, iUuid10,
        iUuid11, iUuid12, iUuid13, iUuid14, iUuid15, iUuid16)
    ficlose(iUuidHandle)

    iUuidBytes[] fillarray iUuid01, iUuid02, iUuid03, iUuid04, iUuid05, iUuid06, iUuid07, iUuid08, iUuid09, iUuid10, \
        iUuid11, iUuid12, iUuid13, iUuid14, iUuid15, iUuid16
    SUuid = uuidStringFromByteArray(iUuidBytes)

    xout SUuid
endop


${CSOUND_INCLUDE_GUARD_ENDIF}

//----------------------------------------------------------------------------------------------------------------------
