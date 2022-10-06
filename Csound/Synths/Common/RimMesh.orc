// Mesh geometry generated in Javascript.
#if IS_PLAYBACK
    gi${InstrumentName}_MeshSegmentCount init _($){SHARED.${RimMesh}.segments}
    gi${InstrumentName}_MeshRowCount init _($){SHARED.${RimMesh}.rows}
    gi${InstrumentName}_MeshAudioPositions[] init _($){SHARED.${RimMesh}.audioPositionsString}
#else
    gi${InstrumentName}_MeshSegmentCount init ${RimMesh.segments}
    gi${InstrumentName}_MeshRowCount init ${RimMesh.rows}
    gi${InstrumentName}_MeshAudioPositions[] init ${RimMesh.audioPositionsString} // [flattened array of xyz coords]
#endif
