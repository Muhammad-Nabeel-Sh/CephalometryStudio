# DICOM test fixtures

| File | Source | Used for |
|---|---|---|
| `JPGExtended.dcm` | pydicom test data (`src/pydicom/data/test_files/JPGExtended.dcm`, MIT-licensed repository). It's the fixed version of NM1_JPLY from the NEMA WG04 sample set (ftp://medical.nema.org/MEDICAL/Dicom/DataSets/WG04/). The patient name is the sample's placeholder ("CompressedSamples^NM1"). | JPEG Extended (12-bit) decoding, checked against libjpeg via pydicom 3.0.2 + pylibjpeg-libjpeg (pixels agree within ±1) |
