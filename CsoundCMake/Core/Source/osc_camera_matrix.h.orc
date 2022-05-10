
//======================================================================================================================
// OSC camera matrix update handler instrument.
//
// Receives camera matrix update OSC messages from the DAW service.
//
//======================================================================================================================

instr HandleOscCameraMatrixMessages
    log_i_trace("instr %s ...", nstrstr(p1))
    if (gi_oscHandle == -1) then
        // Restart this instrument to see if the OSC handle has been set, yet.
        log_i_trace("OSC not initialized. Restarting instrument in 1 second.")
        event("i", p1, 1, -1)
        turnoff
    else
        log_i_trace("Listening for camera matrix updates on port %d.", gi_oscPort)
        kM1 init 0
        kM2 init 0
        kM3 init 0
        kM4 init 0
        kM5 init 0
        kM6 init 0
        kM7 init 0
        kM8 init 0
        kM9 init 0
        kM10 init 0
        kM11 init 0
        kM12 init 0
        kM13 init 0
        kM14 init 0
        kM15 init 0
        kM16 init 0
        kReceived = OSClisten(gi_oscHandle, TRACK_OSC_CAMERA_MATRIX_PATH, "ffffffffffffffff",
            kM1, kM2, kM3, kM4, kM5, kM6, kM7, kM8, kM9, kM10, kM11, kM12, kM13, kM14, kM15, kM16)
        if (kReceived == true) then
            log_k_trace("Camera matrix [%f, %f, %f, %f, ...]", kM1, kM2, kM3, kM4)
            tabw(kM1, 0, gi_AF_3D_ListenerMatrixTableNumber)
            tabw(kM2, 1, gi_AF_3D_ListenerMatrixTableNumber)
            tabw(kM3, 2, gi_AF_3D_ListenerMatrixTableNumber)
            tabw(kM4, 3, gi_AF_3D_ListenerMatrixTableNumber)
            tabw(kM5, 4, gi_AF_3D_ListenerMatrixTableNumber)
            tabw(kM6, 5, gi_AF_3D_ListenerMatrixTableNumber)
            tabw(kM7, 6, gi_AF_3D_ListenerMatrixTableNumber)
            tabw(kM8, 7, gi_AF_3D_ListenerMatrixTableNumber)
            tabw(kM9, 8, gi_AF_3D_ListenerMatrixTableNumber)
            tabw(kM10, 9, gi_AF_3D_ListenerMatrixTableNumber)
            tabw(kM11, 10, gi_AF_3D_ListenerMatrixTableNumber)
            tabw(kM12, 11, gi_AF_3D_ListenerMatrixTableNumber)
            tabw(kM13, 12, gi_AF_3D_ListenerMatrixTableNumber)
            tabw(kM14, 13, gi_AF_3D_ListenerMatrixTableNumber)
            tabw(kM15, 14, gi_AF_3D_ListenerMatrixTableNumber)
            tabw(kM16, 15, gi_AF_3D_ListenerMatrixTableNumber)
        endif
    endif
endin

scoreline_i("i \"HandleOscCameraMatrixMessages\" 0 -1")
