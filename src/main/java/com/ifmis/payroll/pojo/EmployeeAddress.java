package com.ifmis.payroll.pojo;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeAddress {

    private String houseNo;
    private String street;
    private String area;
    private String provinceOfResidence;
    private String pinCode;
    private String country;
}