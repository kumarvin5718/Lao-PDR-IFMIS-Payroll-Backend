package com.ifmis.payroll.entity.master;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "lk_grade_derivation_master")
@Getter
@Setter
@Builder
public class LKGradeDerivationMaster {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Education Level
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "education_level_id", nullable = false)
    private EducationLevel educationLevel;

    // Min Prior Exp (Years)
    @Column(name = "min_exp_years", nullable = false)
    private int minExpYears;

    // Max Prior Exp (Years)
    @Column(name = "max_exp_years", nullable = false)
    private int maxExpYears;

    // Derived Step
    @Column(name = "derived_step", nullable = false)
    private int derivedStep;

    // Derived Grade
    @Column(name = "derived_grade", nullable = false, length = 5)
    private String derivedGrade;

    // Rule Description
    @Column(name = "rule_description")
    private String ruleDescription;
}
