package com.ifmis.payroll.dto;

import com.ifmis.payroll.enums.EmploymentType;
import com.ifmis.payroll.enums.Gender;
import com.ifmis.payroll.enums.Title;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
public class EmployeeRequestDto {

    // ================= PRIMARY KEY =================

    @NotBlank(message = "Employee code is required")
    private String employeeCode;

    // ================= PERSONAL DETAILS =================

    @NotNull(message = "Title is required")
    private Title title;

    @NotBlank(message = "First name is required")
    @Size(max = 80, message = "First name max length is 80")
    private String firstName;

    @NotBlank(message = "Last name is required")
    @Size(max = 80, message = "Last name max length is 80")
    private String lastName;

    @NotNull(message = "Gender is required")
    private Gender gender;

    @NotNull(message = "Date of birth is required")
    @Past(message = "DOB must be in the past")
    private LocalDate dateOfBirth;

    @Email(message = "Invalid email format")
    @NotBlank(message = "Email is required")
    private String email;

    @NotBlank(message = "Mobile number is required")
    @Pattern(regexp = "^[0-9]{8,15}$", message = "Mobile number must be 8-15 digits")
    private String mobileNumber;

    // ================= SERVICE DATES =================

    @NotNull(message = "Date of joining is required")
    private LocalDate dateOfJoining;

    // ================= EMPLOYMENT =================

    @NotNull(message = "Employment type is required")
    private EmploymentType employmentType;

    @NotBlank(message = "Position is required")
    private String position;

    @NotNull(message = "Education level ID is required")
    private UUID educationLevelId;

    @Min(value = 0, message = "Experience cannot be negative")
    @Max(value = 60, message = "Invalid experience")
    private Integer priorExperience;

    // ================= IDENTITY =================

    @NotBlank(message = "Civil Service Card ID is required")
    @Pattern(regexp = "^[0-9]{16}$", message = "Must be exactly 16 digits")
    private String civilServiceCardId;

    @NotBlank(message = "Social Security Number is required")
    @Size(max = 16, message = "Max length is 16")
    private String socialSecurityNumber;

    // ================= ORGANIZATION =================

    @NotBlank(message = "Ministry ID is required")
    private String ministryId;

    @NotBlank(message = "Department ID is required")
    private String departmentId;

    @NotBlank(message = "Division is required")
    private String division;

    // ================= SERVICE LOCATION =================

    @NotBlank(message = "Country is required")
    private String countryKey;

    @NotBlank(message = "Province is required")
    private String provinceKey;

    @NotBlank(message = "District is required")
    private String districtKey;

    // ================= ADDRESS (JSONB) =================

    @Valid
    @NotNull(message = "Address is required")
    private EmployeeAddressDto address;

    // ================= BANK =================

    @NotNull(message = "Bank branch ID is required")
    private UUID branchId;

    @NotBlank(message = "Account number is required")
    @Size(max = 30, message = "Max length is 30")
    private String accountNumber;

    // ================= PAYROLL FLAGS =================

    private Boolean hasSpouse;

    @Max(value = 3, message = "Max 3 eligible children allowed")
    private Integer noOfEligibleChildren;


    // ================= CUSTOM VALIDATION =================

    @AssertTrue(message = "Date of joining must be after date of birth")
    public boolean isValidJoiningDate() {
        if (dateOfBirth == null || dateOfJoining == null) return true;
        return dateOfJoining.isAfter(dateOfBirth);
    }
}