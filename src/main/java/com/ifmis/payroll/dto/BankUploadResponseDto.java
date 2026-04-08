package com.ifmis.payroll.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BankUploadResponseDto {
    private int totalRows;
    private int banksCreated;
    private int categoriesCreated;
    private int branchesCreated;
    private int duplicatesSkipped;
}
