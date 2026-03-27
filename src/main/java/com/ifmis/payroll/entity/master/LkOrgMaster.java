package com.ifmis.payroll.entity.master;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "LK_organization_master")
@Getter
@Setter
@Builder
public class LkOrgMaster {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ministry_id", nullable = false)
    private Ministry ministry;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id", nullable = false)
    private Department department;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "profession_category_id", nullable = false)
    private ProfessionCategory professionCategory;

    // NA Allowance Eligible
    @Column(name = "na_allowance_eligible", nullable = false)
    private Boolean naAllowanceEligible;

    // Field Allowance Type: need to check****
    @Column(name = "field_allowance_type")
    private String fieldAllowanceType;
}
