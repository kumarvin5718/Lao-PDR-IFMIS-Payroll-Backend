package com.ifmis.payroll.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class BankBranchDto {
    private UUID id;
    private String branchName;
    private String branchCode;
    private UUID bankId;
}

