#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: uuid.orc
//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE_GUARD_IFNDEF} CsoundCMake_uuid_orc
${CSOUND_INCLUDE_GUARD_DEFINE} CsoundCMake_uuid_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}

${CSOUND_INCLUDE} "log.orc"


// Python is used to generate new UUIDs.
pyinit


opcode hexCharFromByte_i, S, i
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

    ; log_i_debug("hexCharFromByte_i iNumber = %f, SHexChar = %s", iNumber, SHexChar)
    xout SHexChar
endop


opcode hexCharFromByte_k, S, k
    kNumber xin
    SHexChar = ""

    if (kNumber == 0) then
        SHexChar = "0"
    elseif (kNumber == 1) then
        SHexChar = "1"
    elseif (kNumber == 2) then
        SHexChar = "2"
    elseif (kNumber == 3) then
        SHexChar = "3"
    elseif (kNumber == 4) then
        SHexChar = "4"
    elseif (kNumber == 5) then
        SHexChar = "5"
    elseif (kNumber == 6) then
        SHexChar = "6"
    elseif (kNumber == 7) then
        SHexChar = "7"
    elseif (kNumber == 8) then
        SHexChar = "8"
    elseif (kNumber == 9) then
        SHexChar = "9"
    elseif (kNumber == 10) then
        SHexChar = "a"
    elseif (kNumber == 11) then
        SHexChar = "b"
    elseif (kNumber == 12) then
        SHexChar = "c"
    elseif (kNumber == 13) then
        SHexChar = "d"
    elseif (kNumber == 14) then
        SHexChar = "e"
    elseif (kNumber == 15) then
        SHexChar = "f"
    else
        log_k_warning("Invalid hex byte %f", kNumber)
    endif

    xout SHexChar
endop


opcode hexStringFromByteArray_i, S, i[]
    iByteArray[] xin
    SHex = ""

    iI = 0
    iByteArrayLength = lenarray(iByteArray)
    while (iI < iByteArrayLength) do
        iByte = iByteArray[iI]
        iNumber2 = iByte % 16
        iNumber1 = (iByte - iNumber2) / 16
        SChar1 = hexCharFromByte_i(iNumber1)
        SChar2 = hexCharFromByte_i(iNumber2)
        SHex = strcat(SHex, SChar1)
        SHex = strcat(SHex, SChar2)
        iI += 1
    od

    xout SHex
endop


opcode hexStringFromByteArray_k, S, k[]
    kByteArray[] xin
    SHex = ""

    kI = 0
    kByteArrayLength = lenarray(kByteArray)
    while (kI < kByteArrayLength) do
        kByte = kByteArray[kI]
        kNumber2 = kByte % 16
        kNumber1 = (kByte - kNumber2) / 16
        SChar1 = hexCharFromByte_k(kNumber1)
        SChar2 = hexCharFromByte_k(kNumber2)
        SHex = strcatk(SHex, SChar1)
        SHex = strcatk(SHex, SChar2)
        kI += 1
    od

    xout SHex
endop


opcode uuidStringFromByteArray_i, S, i[]
    ib[] xin
    SUuid = ""

    iUuid1[] fillarray ib[0], ib[1], ib[2], ib[3]
    iUuid2[] fillarray ib[4], ib[5]
    iUuid3[] fillarray ib[6], ib[7]
    iUuid4[] fillarray ib[8], ib[9]
    iUuid5[] fillarray ib[10], ib[11], ib[12], ib[13], ib[14], ib[15]

    SUuid = strcat(SUuid, hexStringFromByteArray_i(iUuid1))
    SUuid = strcat(SUuid, "-")
    SUuid = strcat(SUuid, hexStringFromByteArray_i(iUuid2))
    SUuid = strcat(SUuid, "-")
    SUuid = strcat(SUuid, hexStringFromByteArray_i(iUuid3))
    SUuid = strcat(SUuid, "-")
    SUuid = strcat(SUuid, hexStringFromByteArray_i(iUuid4))
    SUuid = strcat(SUuid, "-")
    SUuid = strcat(SUuid, hexStringFromByteArray_i(iUuid5))

    xout SUuid
endop


opcode uuidStringFromByteArray_k, S, k[]
    kb[] xin
    SUuid = ""

    kUuid1[] init 4
    kUuid2[] init 2
    kUuid3[] init 2
    kUuid4[] init 2
    kUuid5[] init 6

    kUuid1 = fillarray(kb[0], kb[1], kb[2], kb[3])
    kUuid2 = fillarray(kb[4], kb[5])
    kUuid3 = fillarray(kb[6], kb[7])
    kUuid4 = fillarray(kb[8], kb[9])
    kUuid5 = fillarray(kb[10], kb[11], kb[12], kb[13], kb[14], kb[15])

    SUuid = strcatk(SUuid, hexStringFromByteArray_k(kUuid1))
    SUuid = strcatk(SUuid, "-")
    SUuid = strcatk(SUuid, hexStringFromByteArray_k(kUuid2))
    SUuid = strcatk(SUuid, "-")
    SUuid = strcatk(SUuid, hexStringFromByteArray_k(kUuid3))
    SUuid = strcatk(SUuid, "-")
    SUuid = strcatk(SUuid, hexStringFromByteArray_k(kUuid4))
    SUuid = strcatk(SUuid, "-")
    SUuid = strcatk(SUuid, hexStringFromByteArray_k(kUuid5))

    xout SUuid
endop


opcode uuid_i, S, 0
    // Generate a new UUID and add its 16 bytes to an array so the pylevali opcode can read them.
    pylruni("import uuid")
    pylruni("id = uuid.uuid4()")
    pylruni("id_bytes = []")
    pylruni("[ id_bytes.append(float(ord(b))) for b in id.bytes ]")

    // Uncomment the following lines to write the uuid in string form to 'uuid.txt'.
    ; pylruni("text_file = open('uuid.txt', 'w')")
    ; pylruni("text_file.write(str(id))")
    ; pylruni("text_file.close()")

    iIdBytes[] init 16
    iI init 0
    while (iI < lenarray(iIdBytes)) do
        iIdBytes[iI] = pylevali(sprintf("id_bytes[%d]", iI))
        iI += 1
    od
    
    SUuid = uuidStringFromByteArray_i(iIdBytes)
    xout SUuid
endop


opcode uuid_k, S, 0
    // Generate a new UUID and add its 16 bytes to an array so the pylevali opcode can read them.
    pylrun("import uuid")
    pylrun("id = uuid.uuid4()")
    pylrun("id_bytes = []")
    pylrun("[ id_bytes.append(float(ord(b))) for b in id.bytes ]")

    // Uncomment the following lines to write the uuid in string form to 'uuid.txt'.
    ; pylrun("text_file = open('uuid.txt', 'w')")
    ; pylrun("text_file.write(str(id))")
    ; pylrun("text_file.close()")

    kIdBytes[] init 16
    kI init 0
    while (kI < lenarray(kIdBytes)) do
        kIdBytes[kI] = pyleval(sprintfk("id_bytes[%d]", kI))
        kI += 1
    od
    
    SUuid = uuidStringFromByteArray_k(kIdBytes)
    xout SUuid
endop


${CSOUND_INCLUDE_GUARD_ENDIF}

//----------------------------------------------------------------------------------------------------------------------
