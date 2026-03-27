package com.ifmis.payroll.dto;

import lombok.Data;

@Data
public class EmployeeRequestDto {

    private String employeeCode;
    private String title;
    private String firstName;
    private String lastName;
    private String gender;
    private String dateOfBirth;
    private String email;
    private String mobileNumber;
    private String dateOfJoining;
}