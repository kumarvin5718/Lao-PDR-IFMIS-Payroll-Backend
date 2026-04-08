package com.ifmis.payroll.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LocationUploadResponseDto {
    private int totalRows;
    private int countriesCreated;
    private int provincesCreated;
    private int districtsCreated;
    private int locationsCreated;
    private int duplicatesSkipped;
    private int failedRows;
}
