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
public class EmployeeResponseDto {

    // ================= PRIMARY KEY =================

    private String employeeCode;

    // ================= PERSONAL DETAILS =================

    private Title title;

    private String firstName;
    private String lastName;

    private Gender gender;

    private LocalDate dateOfBirth;

    private String email;

    private String mobileNumber;

    // ================= SERVICE DATES =================

    private LocalDate dateOfJoining;
    private Integer yearsOfService;
    private LocalDate dateOfRetirement;

    // ================= EMPLOYMENT =================

    private EmploymentType employmentType;

    private String position;

    private UUID educationLevelId;
    private String educationLevelName;

    private Integer priorExperience;
    private Integer grade;
    private Integer step;

    // ================= IDENTITY =================

    private String civilServiceCardId;

    private String socialSecurityNumber;

    // ================= ORGANIZATION =================

    private String ministryId;
    private String ministryName;

    private String departmentId;
    private String departmentName;

    private String division;
    private String divisionName;

    // ================= SERVICE LOCATION =================

    private String countryKey;
    private String countryName;

    private String provinceKey;
    private String provinceName;

    private String districtKey;
    private String districtName;

    private String professionalCategory;
    private Boolean isRemoteArea;
    private Boolean isForeignPosting;
    private Boolean isHazardousArea;

    // ================= ADDRESS (JSONB) =================
    private EmployeeAddressDto address;

    // ================= BANK =================

    private UUID branchId;
    private String bankName;
    private String branchName;
    private String branchCode;
    private String swiftCode;

    private String accountNumber;

    private Boolean hasSpouse;

    private Integer noOfEligibleChildren;
    private String positionLevel;
    private Boolean isNAMember;
    private String fieldAllowanceType;

}