package com.ifmis.payroll.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BankUploadRowDto {
    private String bankName;
    private String abbrev;
    private String bankKey;
    private String category;
    private String branchName;
    private String branchCode;
    private String city;
    private String swiftBICCode;
    private String branchAddress;
    private String bankHQAddress;
    private String telephone;
    private String ownership;
    private Integer established;
    private String website;
}
