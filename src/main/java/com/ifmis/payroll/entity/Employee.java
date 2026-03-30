package com.ifmis.payroll.entity;

import com.ifmis.payroll.entity.master.*;
import com.ifmis.payroll.enums.EmploymentType;
import com.ifmis.payroll.enums.Gender;
import com.ifmis.payroll.enums.Title;
import com.ifmis.payroll.pojo.EmployeeAddress;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;

@Entity
@Table(name = "employee")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Employee {

    // ================= PRIMARY KEY (START) =================

    // 1: Employee Code (alphanumeric, ex: LAO00001)
    @Id
    @Column(name = "employee_code", nullable = false, unique = true)
    private String employeeCode;

    // ================= 1: PRIMARY KEY (END) =================


    // ================= PERSONAL DETAILS (START) =================

    // 2: Title (Mr, Mrs, Ms, etc.)
    @Enumerated(EnumType.STRING)
    private Title title;

    // 3: First Name (used in search → keep as column, NOT JSONB)
    @Column(name = "first_name", nullable = false, length = 80)
    private String firstName;

    // 4: Last Name
    @Column(name = "last_name", nullable = false, length = 80)
    private String lastName;

    // 5: Gender
    @Enumerated(EnumType.STRING)
    @Column(name = "gender", nullable = false)
    private Gender gender;

    // 6: Date of Birth
    @Column(name = "date_of_birth", nullable = false)
    private LocalDate dateOfBirth;

    // 7: Email (Unique)
    @Column(name = "email", nullable = false, unique = true)
    private String email;

    // 8: Mobile Number (Unique)
    @Column(name = "mobile_number", nullable = false, unique = true)
    private String mobileNumber;

    // ================= PERSONAL DETAILS (END) =================


    // ================= SERVICE DATES (START) =================

    // 9: Date of Joining
    @Column(name = "date_of_joining", nullable = false)
    private LocalDate dateOfJoining;

    // 10: Years of Service (Calculated)
    @Column(name = "year_of_service", nullable = false)
    private Integer yearOfService;

    // 11: Date of Retirement (DOB + 60 years)
    @Column(name = "date_of_retirement", nullable = false)
    private LocalDate dateOfRetirement;

    // ================= SERVICE DATES (END) =================


    // ================= EMPLOYMENT & GRADE (START) =================

    // 12: Employment Type
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EmploymentType employmentType;

    // 13: Position / Designation
    @Column(name = "position")
    private String position;

    // 14: Education Level (Master Data)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "education_level_id", nullable = false)
    private EducationLevel educationLevel;

    // 15: Prior Experience (Years before Govt)
    @Column(name = "prior_experience", length = 3)
    private Integer priorExperience;

    // 16: Grade & Step (Derived from Master)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "grade_and_step_id", nullable = false)
    private LKGradeDerivationMaster gradeAndStep;

    // ================= EMPLOYMENT & GRADE (END) =================


    // ================= IDENTITY CARDS (START) =================

    // 17: Civil Service Card ID (16 digit, Unique)
    @Column(name = "civil_service_card_id", length = 16, nullable = false, unique = true)
    private String civilServiceCardId;

    // 18: Social Security Number (Unique)
    @Column(name = "social_security_number", length = 16, nullable = false, unique = true)
    private String socialSecurityNumber;

    // ================= IDENTITY CARDS (END) =================


    // ================= ORGANIZATION (START) =================

    // 19: Ministry
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ministry_id", nullable = false)
    private Ministry ministry;

    // 20: Department
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id", nullable = false)
    private Department department;

    // 21: Division (No master yet -> keep as String)
    @Column(name = "division", nullable = false)
    private String division;

    // =================  ORGANIZATION (END) =================


    // ================= SERVICE LOCATION (START) =================

    // 22-24: Service Location (Country + Province + District)
    // USER INPUT (Selected from LKLocationMaster)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "location_id", nullable = false)
    private LKLocationMaster location;

    // 25: Profession Category
    @Column(name = "profession_category")
    private String professionCategory;

    // ================= SERVICE LOCATION (END) =================


    // ================= ADDRESS (JSONB) (START) =================

    // 26: Employee Address (Stored as JSONB)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "address", columnDefinition = "jsonb")
    private EmployeeAddress address;

    // ================= ADDRESS (JSONB) (END) =================


    // ================= BANK DETAILS (START) =================

    // 27: Bank Branch
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "branch_id", nullable = false)
    private BankBranch branch;

    // 28: Account Number (Unique)
    @Column(name = "account_number", nullable = false, unique = true, length = 30)
    private String accountNumber;

    // ================= BANK DETAILS (END) =================


    // ================= PAYROLL FLAGS (START) =================

    // 29: Has Spouse
    private Boolean hasSpouse;

    // 30: Number of Eligible Children (Max 3)
    private Integer noOfEligibleChildren;

    // 31: Position Level
    private String positionLevel;

    // 32: National Assembly Member
    private Boolean isNAMember;

    // 33: Field Allowance Type
    private String fieldAllowanceType;

    // ================= PAYROLL FLAGS (END) =================



    @PrePersist
    @PreUpdate
    public void calculateFields() {

        // Calculate Years of Service
        if (dateOfJoining != null) {
            this.yearOfService =
                    java.time.Period.between(dateOfJoining, LocalDate.now()).getYears();
        }

        // Calculate Retirement Date (DOB + 60 years)
        if (dateOfBirth != null) {
            this.dateOfRetirement = dateOfBirth.plusYears(60);
        }
    }

}