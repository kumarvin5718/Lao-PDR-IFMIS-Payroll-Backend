package com.ifmis.payroll.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class EmployeeResponseDto {

    private String employeeCode;
    private String title;
    private String firstName;
    private String lastName;
    private String gender;
    private String dateOfBirth;
    private String email;
    private String mobileNumber;
    private String dateOfJoining;
    private Integer yearOfService;
    private String dateOfRetirement;
}