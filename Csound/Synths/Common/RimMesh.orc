// Mesh geometry generated in Javascript.
#if IS_PLAYBACK
    gi${InstrumentName}_MeshSegmentCount init _($){${RimMesh}.segments}
    gi${InstrumentName}_MeshRowCount init _($){${RimMesh}.rows}
    gi${InstrumentName}_MeshAudioPositions[] init _($){${RimMesh}.audioPositionsString}
#else
    gi${InstrumentName}_MeshSegmentCount init ${RimMesh.segments}
    gi${InstrumentName}_MeshRowCount init ${RimMesh.rows}
    gi${InstrumentName}_MeshAudioPositions[] init ${RimMesh.audioPositionsString} // [flattened array of xyz coords]
#endif
