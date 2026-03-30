package com.ifmis.payroll.dto;

import jakarta.validation.constraints.*;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class EmployeeAddressDto {

    @NotBlank(message = "House number is required")
    @Size(max = 50)
    private String houseNo;

    @NotBlank(message = "Street is required")
    @Size(max = 100)
    private String street;

    @NotBlank(message = "Area is required")
    @Size(max = 100)
    private String area;

    @NotBlank(message = "Province is required")
    @Size(max = 100)
    private String provinceOfResidence;

    @NotBlank(message = "Pin code is required")
    private String pinCode;

    @NotBlank(message = "Country is required")
    @Size(max = 100)
    private String country;
}