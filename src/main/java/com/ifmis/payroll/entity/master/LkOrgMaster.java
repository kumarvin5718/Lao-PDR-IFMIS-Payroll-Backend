package com.ifmis.payroll.entity.master;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "lk_organization_master")
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class LkOrgMaster {

    @Id
    @Column(name = "id", unique = true, nullable = false, updatable = false)
    private UUID id;

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
