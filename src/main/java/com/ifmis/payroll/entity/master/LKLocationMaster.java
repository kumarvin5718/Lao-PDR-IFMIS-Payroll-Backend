package com.ifmis.payroll.entity.master;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "lk_location_master",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"country_key", "province_key", "district_key"})
        })
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class LKLocationMaster {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "country_key", nullable = false)
    private Country country;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "province_key", nullable = false)
    private Province province;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "district_key", nullable = false)
    private District district;

    @Column(name = "is_remote")
    private Boolean isRemote;

    @Column(name = "is_hazardous")
    private Boolean isHazardous;

    @Column(name = "is_foreign_posting")
    private Boolean isForeignPosting;

    @Column(name = "notes", nullable = true)
    private String notes;
}