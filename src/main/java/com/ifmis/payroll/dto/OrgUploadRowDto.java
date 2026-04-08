package com.ifmis.payroll.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrgUploadRowDto {
    private String ministryName;
    private String ministryKey;
    private String departmentName;
    private String deptKey;
    private String professionCategory;
    private String naAllowanceEligible;
    private String fieldAllowanceType;
}
