#include "definitions.h"

${CSOUND_INCLUDE} "log.orc"

giXYPad_width = 300
giXYPad_height = 300

giXYPad_indicatorWidth = 10
giXYPad_indicatorHeight = 10

giYPad_indicatorWidth = 50
giYPad_indicatorHeight = 1

opcode xyIndicatorBounds, S, kk
    kX, kY xin
    kBoundsX = (giXYPad_width / 2) + (kX * (giXYPad_width / 2)) - giXYPad_indicatorWidth / 2
    kBoundsY = giXYPad_height - ((giXYPad_height / 2) + (kY * (giXYPad_height / 2)) + giXYPad_indicatorHeight / 2)
    xout sprintfk("bounds(%d, %d, %d, %d)", kBoundsX, kBoundsY, giXYPad_indicatorWidth, giXYPad_indicatorHeight)
endop

opcode zIndicatorBounds, S, k
    kY xin
    kBoundsY = giXYPad_height - ((giXYPad_height / 2) + (kY * (giXYPad_height / 2)) + giYPad_indicatorHeight / 2)
    kBoundsY = min(kBoundsY, giXYPad_height - 1)
    xout sprintfk("bounds(%d, %d, %d, %d)", 0, kBoundsY, giYPad_indicatorWidth, giYPad_indicatorHeight)
endop

opcode setPositionR, 0, k
    kR xin
    chnset(kR, "positionR")
endop

// T = degrees.
opcode setPositionT, 0, k
    kT xin
    if (kT > 180) then
        kT = -180 + (kT - 180)
    endif
    chnset(kT, "positionT")
endop

opcode setPositionPolarZ, 0, k
    kZ xin
    chnset(kZ, "positionPolarZ")
endop

opcode setPositionX, 0, k
    kX xin
    chnset(kX, "positionX")
endop

opcode setPositionY, 0, k
    kY xin
    chnset(kY, "positionY")
endop

opcode setPositionCartesianZ, 0, k
    kZ xin
    chnset(kZ, "positionCartesianZ")
endop

opcode setPositionXYIndicator, 0, kk
    kX, kY xin
    chnset(xyIndicatorBounds(kX, kY), "positionXY_xypad_indicator_ui")
endop

opcode setPositionCartesianZIndicator, 0, k
    kZ xin
    chnset(zIndicatorBounds(kZ), "positionCartesianZ_xypad_indicator_ui")
endop

opcode setPositionRTIndicator, 0, kk
    kR, kT xin
    kT += PI / 2
    chnset(xyIndicatorBounds(kR * cos(kT), kR * sin(kT)), "positionRT_xypad_indicator_ui")
endop

opcode setPositionPolarZIndicator, 0, k
    kZ xin
    chnset(zIndicatorBounds(kZ), "positionPolarZ_xypad_indicator_ui")
endop

opcode setPositionMaxXYZ, 0, k
    kMaxXYZ xin
    chnset(kMaxXYZ, "positionMaxXYZ")
endop

opcode setPositionMaxRZ, 0, k
    kMaxRZ xin
    chnset(kMaxRZ, "positionMaxRZ")
endop


instr HandlePositionChanges
    log_i_info("%s ...", nstrstr(p1))

    kIsFirstPass init true
    if (gk_i > 0) then
        kIsFirstPass = false
    endif

    // Cartesian controls.

    kX init 0
    kY init 0
    kCartesianZ init 0
    kCartesianMaxDistance init 0

    // Check xypad first so it doesn't override actual value when Reaper starts up.
    kPositionX_xypad = -1 + chnget:k("positionXY_xypad_inputX") / (giXYPad_width / 2)
    kPositionY_xypad = -1 + chnget:k("positionXY_xypad_inputY") / (giXYPad_height / 2)
    if (changed(kPositionX_xypad) == true) then
        kX = kPositionX_xypad
    endif
    if (changed(kPositionY_xypad) == true) then
        kY = kPositionY_xypad
    endif

    kChangedXY = false
    if (changed(kX) == true) then
        setPositionX(kX)
        kChangedXY = true
    endif
    if (changed(kY) == true) then
        setPositionY(kY)
        kChangedXY = true
    endif

    if (kChangedXY == false) then
        kX = chnget:k("positionX")
        kY = chnget:k("positionY")
        if (changed(kX) == true) then
            kChangedXY = true
        elseif (changed(kY) == true) then
            kChangedXY = true
        endif
    endif

    kCartesianZ = chnget:k("positionCartesianZ_xypad_inputY") / (giXYPad_height / 2)
    if (changed(kCartesianZ) == true) then
        setPositionCartesianZ(kCartesianZ)
    else
        kCartesianZ = chnget:k("positionCartesianZ")
    endif
    if (changed(kCartesianZ) == true) then
        setPositionCartesianZ(kCartesianZ)
    endif

    // Max XYZ controls.

    kMaxXYZ = chnget:k("positionMaxXYZ")
    if (changed(kMaxXYZ) == false) then
        kMaxXYZ_vslider = chnget:k("positionMaxXYZ_vslider")
        if (changed(kMaxXYZ_vslider) == true) then
            kMaxXYZ = kMaxXYZ_vslider
        endif
    else
        chnset(kMaxXYZ, "positionMaxXYZ_vslider")
    endif

    if (changed(kMaxXYZ) == true) then
        setPositionMaxXYZ(kMaxXYZ)
    endif

    // Update cartesian indicator UIs.

    if (kIsFirstPass == true) then
        setPositionXYIndicator(kX, kY)
    elseif (changed(kX) == true) then
        setPositionXYIndicator(kX, kY)
    elseif (changed(kY) == true) then
        setPositionXYIndicator(kX, kY)
    endif
    if (kIsFirstPass == true) then
        setPositionCartesianZIndicator(kCartesianZ)
    elseif (changed(kCartesianZ) == true) then
        setPositionCartesianZIndicator(kCartesianZ)
    endif

    // Polar controls.

    kR init 0
    kT init 0
    kPolarZ init 0
    kPolarMaxDistance init 0

    // Check xypad first so it doesn't override actual value when Reaper starts up.
    kRT_xypad_x = -1 + chnget:k("positionRT_xypad_inputX") / (giXYPad_width / 2)
    kRT_xypad_y = -1 + chnget:k("positionRT_xypad_inputY") / (giXYPad_height / 2)

    kChangedRT = false
    if (changed(kRT_xypad_x) == true) then
        kChangedRT = true
    endif
    if (changed(kRT_xypad_y) == true) then
        kChangedRT = true
    endif

    if (kChangedRT == true) then
        kR = sqrt(kRT_xypad_x * kRT_xypad_x + kRT_xypad_y * kRT_xypad_y)
        kR = min(kR, 1)
        kT = taninv2(kRT_xypad_y, kRT_xypad_x) - PI / 2
        kT_knob_degrees = -180 * kT / PI

        if (changed(kR) == true) then
            setPositionR(kR)
        endif
        if (changed(kT) == true) then
            setPositionT(kT_knob_degrees)
        endif
    else
        kR = chnget:k("positionR")
        kR = min(kR, 1)
        kT = -PI * chnget:k("positionT") / 180
        if (changed(kR) == true) then
            kChangedRT = true
        elseif (changed(kT) == true) then
            kChangedRT = true
        endif
    endif

    kPositionPolarZ_xypad = chnget:k("positionPolarZ_xypad_inputY") / (giXYPad_height / 2)
    if (changed(kPositionPolarZ_xypad) == true) then
        kPolarZ = kPositionPolarZ_xypad
    else
        kPolarZ = chnget:k("positionPolarZ")
    endif
    if (changed(kPolarZ) == true) then
        setPositionPolarZ(kPolarZ)
    endif

    // Max R+Z controls.

    kMaxRZ = chnget:k("positionMaxRZ")
    if (changed(kMaxRZ) == false) then
        kMaxRZ_vslider = chnget:k("positionMaxRZ_vslider")
        if (changed(kMaxRZ_vslider) == true) then
            kMaxRZ = kMaxRZ_vslider
        endif
    else
        chnset(kMaxRZ, "positionMaxRZ_vslider")
    endif

    if (changed(kMaxRZ) == true) then
        setPositionMaxRZ(kMaxRZ)
    endif

    // Update polar indicator UIs.

    if (kIsFirstPass == true) then
        setPositionRTIndicator(kR, kT)
    elseif (kChangedRT == true) then
        setPositionRTIndicator(kR, kT)
    endif
    if (kIsFirstPass == true) then
        setPositionPolarZIndicator(kPolarZ)
    elseif (changed(kPolarZ) == true) then
        setPositionPolarZIndicator(kPolarZ)
    endif

end:
    log_i_info("%s - done", nstrstr(p1))
endin


alwayson "HandlePositionChanges"
