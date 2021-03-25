
// This file is for csd-specific options that require the instrument name and .csd file path to be known.
// TODO: Fix the core_options.h INCDIR setting overriding this one. Concat the dirs with a semicolon.
--env:INCDIR=${CSD_PREPROCESSED_FILES_DIR}
#include "core_options.h"
