package com.ifmis.payroll.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrgUploadResponseDto {
    private int totalRows;
    private int ministriesCreated;
    private int departmentsCreated;
    private int professionsCreated;
    private int orgRecordsCreated;
    private int duplicatesSkipped;
    private int failedRows;
}
