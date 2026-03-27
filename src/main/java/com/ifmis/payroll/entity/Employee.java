package com.ifmis.payroll.entity;

import com.ifmis.payroll.entity.master.BankBranch;
import com.ifmis.payroll.entity.master.Department;
import com.ifmis.payroll.entity.master.Ministry;
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
    //1: Employee Code: alphanumeric, ex: LAO00001 12 char
    @Id
    @Column(name = "employee_code", nullable = false, unique = true)
    private String employeeCode;

    //2: titles Ex: Mrs., Ms.
    @Enumerated(EnumType.STRING)
    private Title title;

    //3: First Name: as we need firstname and last name for search use them as jsonb not recommended
    @Column(name = "first_name", nullable = false, length = 80)
    private String firstName;

    //4: Last Name
    @Column(name = "last_name", nullable = false, length = 80)
    private String lastName;

    //5: Gender
    @Column(name = "gender", nullable = false)
    @Enumerated(EnumType.STRING)
    private Gender gender;

    //6: DOB: Date
    @Column(name = "date_of_birth", nullable = false)
    private LocalDate dateOfBirth;

    //7: Email
    @Column(name = "email", nullable = false, unique = true) // added unique
    private String email;

    //8: Mobile Number: +856 20 94519179
    @Column(name = "mobile_number", nullable = false, unique = true) // added unique
    private String mobileNumber;

    //9: Service Dates: Date Of Joining
    @Column(name = "date_of_joining", nullable = false)
    private LocalDate dateOfJoining;

    //10: Year Of Service: Calculated from Today Date - Date Of Joining (In years)
    @Column(name = "year_of_service", nullable = false)
    private Integer yearOfService;

    //11: Date Of Retirement: Calculated from DOB + 60 years
    @Column(name = "date_of_retirement", nullable = false)
    private LocalDate dateOfRetirement;

    //12
    @OneToOne(mappedBy = "employee", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private EmployeeEmploymentAndGrade employeeEmploymentAndGrade;

    // *** Start Identity Cards ***
    //13: Civil Service Card ID: 16 digits numeric  (Cant store in JSONB as validation will get affect)
    @Column(name = "civil_service_card_id", length = 16, nullable = false, unique = true)
    private String civilServiceCardId;

    //14: Social Security No: 12 Char alphanumeric (Cant store in JSONB as validation will get affect)
    @Column(name = "social_security_number", length = 16, nullable = false, unique = true)
    private String socialSecurityNumber;
    // *** end Identity Cards ***

    //15: ** START organization **
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ministry_id", nullable = false)
    private Ministry ministry;

    //16
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id", nullable = false)
    private Department department;

    //17: ** Check this:
    @Column(name = "division", nullable = false)
    private String division;
    // ** END organization **

    //22
    @OneToOne(mappedBy = "employee", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private EmployeeServiceLocation serviceLocation;

    //18: ** Start EMP Address **
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "address", columnDefinition = "jsonb")
    private EmployeeAddress address;
    // ** End EMP Address **

    //19: Many employees can use same branch
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "branch_id", nullable = false)
    private BankBranch branch;

    //20:  Account number
    @Column(name = "account_number", nullable = false, unique = true, length = 30)
    private String accountNumber;

    // 21
    @OneToOne(mappedBy = "employee", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private EmployeePayrollFlags payrollFlags;


    //  Auto calculations
    @PrePersist
    @PreUpdate
    public void calculateFields() {

        if (dateOfJoining != null) {
            this.yearOfService =
                    java.time.Period.between(dateOfJoining, LocalDate.now()).getYears();
        }

        if (dateOfBirth != null) {
            this.dateOfRetirement = dateOfBirth.plusYears(60);
        }
    }
}