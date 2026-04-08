package com.ifmis.payroll.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LocationUploadRowDto {
    private String country;
    private String countryKey;
    private String provinceKey;
    private String provincePosting;
    private String districtKey;
    private String district;
    private String isRemote;
    private String isHazardous;
    private String notes;
}
