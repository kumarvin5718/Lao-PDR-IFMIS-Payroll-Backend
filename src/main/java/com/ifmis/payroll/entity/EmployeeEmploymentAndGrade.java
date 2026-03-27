package com.ifmis.payroll.entity;

import com.ifmis.payroll.enums.EmploymentType;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "employee_employment_grade")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmployeeEmploymentAndGrade extends AuditableEntity{

    //Primary Key
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false)
    private UUID id;

    // Employment Type
    @Enumerated(EnumType.STRING)
    private EmploymentType employmentType;

    // Position / Designation
    private String position;

    // Education Qualification

    // Prior Experience (Yrs before Govt)

    // Grade: Calculated

    // Step: calculated
}
