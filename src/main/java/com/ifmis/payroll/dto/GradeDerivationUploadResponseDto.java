package com.ifmis.payroll.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GradeDerivationUploadResponseDto {
    private int totalRows;
    private int educationLevelsCreated;
    private int recordsCreated;
    private int duplicatesSkipped;
    private int invalidRanges;
    private int failedRows;
}
