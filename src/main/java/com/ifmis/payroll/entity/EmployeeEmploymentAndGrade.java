package com.ifmis.payroll.entity;

import com.ifmis.payroll.entity.master.EducationLevel;
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
public class EmployeeEmploymentAndGrade{

    //Primary Key
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_code", nullable = false, unique = true)
    private Employee employee;

    // Employment Type
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EmploymentType employmentType;

    // Position / Designation
    @Column(name = "position")
    private String position;

    // Education Qualification
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "education_level_id", nullable = false)
    private EducationLevel educationLevel;

    // Prior Experience (Yrs before Govt)
    @Column(name="prior_experience", length = 3)
    private Integer priorExperience;

    // Grade: Calculated
    @Column(name="grade", length = 3)
    private Integer grade;

    // Step: calculated
    @Column(name="step", length = 3)
    private Integer step;

}