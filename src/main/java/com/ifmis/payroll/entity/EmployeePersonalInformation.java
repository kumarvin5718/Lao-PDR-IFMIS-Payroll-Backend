package com.ifmis.payroll.entity;

import com.ifmis.payroll.enums.Gender;
import com.ifmis.payroll.enums.Title;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "employee_personal_information")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmployeePersonalInformation extends AuditableEntity{

    // Employee Code: alpha numeric, ex: LAO00001 12 char
    @Id
    @Column(name = "employee_code", nullable = false, unique = true)
    private String employeeCode;

    // titles Ex: Mrs., Ms.
    @Enumerated(EnumType.STRING)
    private Title titles;

    // First Name
    @Column(name = "first_name", nullable = false, length = 80)
    private String firstName;

    // Last Name
    @Column(name = "last_name", nullable = false, length = 80)
    private String lastName;

    // Gender
    @Column(name = "gender", nullable = false)
    @Enumerated(EnumType.STRING)
    private Gender gender;

    // DOB: Date
    @Column(name = "date_of_birth", nullable = false)
    private LocalDate dateOfBirth;

    // Email
    @Column(name = "email", nullable = false)
    private String email;

    // Mobile Number: +856 20 94519179
    @Column(name = "mobile_number", nullable = false)
    private String mobileNumber;

    // Service Dates: Date Of Joining
    @Column(name = "date_of_joining", nullable = false)
    private LocalDate dateOfJoining;

    // Year Of Service: Calculated from Today Date - Date Of Joining (In years)
    @Column(name = "year_of_service", nullable = false, length = 3)
    private Integer yearOfService;

    // Date Of Retirement: Calculated from DOB + 60 years
    @Column(name = "date_of_retirement", nullable = false)
    private LocalDate dateOfRetirement;

}
